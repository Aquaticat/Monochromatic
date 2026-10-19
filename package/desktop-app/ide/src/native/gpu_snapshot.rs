//! A GPU snapshot harness for the native tests:
//!  Slint's FemtoVG renderer draws a window into a texture on a hardware Vulkan device,
//!  without a display server,
//!  and `Window::take_snapshot` reads the pixels back.
//!
//! A test calls `install_gpu_platform` first,
//!  before it creates any window,
//!  and then reads pixels with `window.window().take_snapshot()`
//!  or the `snapshot` helper here.
//!  The platform can be installed once per process,
//!  and nextest runs each test in its own process;
//!  plain `cargo test` would run several tests in one process and the second install would fail.
//!  No CPU rasterizer is used:
//!  an adapter of the CPU kind (lavapipe, llvmpipe) is refused with a message naming every adapter that was seen.

/// What:
///  `FemtoVGWGPURenderer` is Slint's FemtoVG renderer that draws into a `wgpu` texture,
///  `Platform` is the trait a custom Slint platform implements,
///  `PlatformError` is its error type,
///  and `WindowAdapter` is the trait that connects one Slint window to a renderer and a size.
/// Why:
///  The harness is a custom platform whose windows render on the GPU;
///  Slint's own testing backend can only be built with its software or Skia renderers
///  (`i-slint-backend-testing-1.18.1/testing_backend.rs`, `create_headless_renderer`).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { FemtoVGWGPURenderer, Platform, PlatformError, WindowAdapter } from 'slint/platform';
/// ```
use slint::platform::{
    Platform, PlatformError, WindowAdapter, WindowEvent, femtovg_renderer::FemtoVGWGPURenderer,
    set_platform,
};
/// The `wgpu` crate as Slint re-exports it,
///  so the harness uses exactly the wgpu release (30) that Slint's renderer was built against.
use slint::wgpu_30::wgpu;
/// Window sizes,
///  the pixel type of a snapshot,
///  and the window handle.
use slint::{PhysicalSize, Rgba8Pixel, SharedPixelBuffer, Window, WindowSize};
/// Single-threaded shared ownership,
///  as Slint's adapters are shared.
use std::{cell::Cell, rc::Rc};

/// Window size before the component states a preferred size,
///  the size Slint's testing backend also uses.
const DEFAULT_WIDTH: u32 = 800;
/// Height of the same default window.
const DEFAULT_HEIGHT: u32 = 600;

/// What:
///  `hardware_rank` scores a `wgpu::DeviceType` for adapter choice;
///  `Option<u32>` is "a number or nothing" (`number | undefined`).
/// Why:
///  A discrete GPU is preferred over an integrated one,
///  and every other kind (the CPU kind above all) is refused by returning nothing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function hardwareRank(kind: DeviceType): number | undefined {
///   if (kind === 'DiscreteGpu') return 2;
///   if (kind === 'IntegratedGpu') return 1;
///   return undefined;
/// }
/// ```
fn hardware_rank(kind: wgpu::DeviceType) -> Option<u32> {
    if kind == wgpu::DeviceType::DiscreteGpu {
        return Some(2);
    }
    if kind == wgpu::DeviceType::IntegratedGpu {
        return Some(1);
    }
    return None;
}

/// What:
///  `open_hardware_device` returns the `wgpu` instance,
///  device,
///  queue,
///  and the chosen adapter's name.
///  `Result<T, String>` is a value or an error message (a function that may throw).
///  `Vec` is a growable array.
/// Why:
///  The device must be a hardware Vulkan one with full limits
///  (`wgpu::Limits::default()`, the limits the application's GPU text design needs).
///  Only the Vulkan backend is asked for.
///  A machine with no hardware adapter fails with the list of adapters it has,
///  instead of falling back to a CPU one.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function openHardwareDevice(): { instance, device, queue, name } { /* throws a string */ }
/// ```
fn open_hardware_device() -> Result<(wgpu::Instance, wgpu::Device, wgpu::Queue, String), String> {
    // What: a current-thread tokio runtime runs the two wgpu futures to completion, `?` returns early with the error.
    // Why: wgpu's adapter and device requests are async; tokio is already a dependency of the application.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const runtime = new Runtime(); // throws on failure
    // ```
    let runtime = tokio::runtime::Builder::new_current_thread()
        .build()
        .map_err(|error| format!("no async runtime for wgpu: {error}"))?;
    // What: an instance that may open only the Vulkan backend (not GL), with default flags and options.
    // Why: Slint also keeps the GL backend away from wgpu; GL has shown rendering artifacts.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const instance = new GPUInstance({ backends: ['vulkan'] });
    // ```
    let mut description = wgpu::InstanceDescriptor::new_without_display_handle();
    description.backends = wgpu::Backends::VULKAN;
    let instance = wgpu::Instance::new(description);
    // What: every Vulkan adapter, as an owned list.
    // Why: the choice below needs all of them, and the failure message names them.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const adapters = await instance.enumerateAdapters('vulkan');
    // ```
    let adapters = runtime.block_on(instance.enumerate_adapters(wgpu::Backends::VULKAN));
    let mut seen: Vec<String> = Vec::new();
    let mut best: Option<(u32, wgpu::Adapter)> = None;
    for adapter in adapters {
        let info = adapter.get_info();
        seen.push(format!(
            "{} ({:?}, {})",
            info.name, info.device_type, info.driver
        ));
        // What: `let Some(rank) = ... else { continue }` unwraps a present value or skips this adapter.
        // Why: adapters of any kind but a GPU, such as lavapipe, are skipped here and never chosen.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const rank = hardwareRank(info.deviceType);
        // if (rank === undefined) continue;
        // ```
        let Some(rank) = hardware_rank(info.device_type) else {
            continue;
        };
        let better = match &best {
            Some((best_rank, _)) => rank > *best_rank,
            None => true,
        };
        if better {
            best = Some((rank, adapter));
        }
    }
    let Some((_, adapter)) = best else {
        return Err(format!(
            "no hardware Vulkan adapter for the GPU snapshot harness; adapters seen: [{}]. \
             The container needs --device /dev/dri and the image's vulkan-loader and mesa-vulkan-drivers",
            seen.join(", ")
        ));
    };
    // What: default (full) limits raised to the adapter's resolution limits, as Slint does for its own device.
    // Why: Vello's compute shaders need storage buffers, which Slint's downlevel default limits forbid.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const limits = { ...defaultLimits, ...adapter.limits.resolution };
    // ```
    let limits = wgpu::Limits::default().using_resolution(adapter.limits());
    let device_description = wgpu::DeviceDescriptor {
        label: Some("ide gpu snapshot harness"),
        required_limits: limits,
        ..wgpu::DeviceDescriptor::default()
    };
    let (device, queue) = runtime
        .block_on(adapter.request_device(&device_description))
        .map_err(|error| format!("the hardware adapter refused the device: {error}"))?;
    let name = adapter.get_info().name;
    return Ok((instance, device, queue, name));
}

/// What:
///  One Slint window of the harness:
///  the `Window` handle,
///  the renderer that draws it on the GPU,
///  and its size in physical pixels (`Cell` is a value that can be replaced through a shared reference).
/// Why:
///  Slint asks the adapter for its renderer and its size,
///  and the test's `take_snapshot` call reaches the renderer through it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class GpuWindow implements WindowAdapter { window: Window; renderer: Renderer; size: PhysicalSize }
/// ```
struct GpuWindow {
    /// The handle the component and the tests use.
    window: Window,
    /// Draws the scene into a wgpu texture; its snapshot reads that texture back.
    renderer: FemtoVGWGPURenderer,
    /// Physical size; zero width means no size was set yet.
    size: Cell<PhysicalSize>,
}

impl WindowAdapter for GpuWindow {
    fn window(&self) -> &Window {
        return &self.window;
    }

    /// Size before the component states one: the default, as in Slint's testing backend.
    fn size(&self) -> PhysicalSize {
        if self.size.get().width == 0 {
            return PhysicalSize::new(DEFAULT_WIDTH, DEFAULT_HEIGHT);
        }
        return self.size.get();
    }

    /// Mirrors Slint's testing window:
    ///  the window learns the logical size at scale 1 first,
    ///  then the adapter stores the physical size.
    fn set_size(&self, size: WindowSize) {
        self.window.dispatch_event(WindowEvent::Resized {
            size: size.to_logical(1.0),
        });
        self.size.set(size.to_physical(1.0));
    }

    fn renderer(&self) -> &dyn slint::platform::Renderer {
        return &self.renderer;
    }

    /// The first layout gives the window the preferred size of its component.
    fn update_window_properties(&self, properties: slint::platform::WindowProperties<'_>) {
        if self.size.get().width == 0 {
            let preferred = properties.layout_constraints().preferred;
            self.size
                .set(preferred.to_physical(self.window.scale_factor()));
        }
    }
}

/// What:
///  The one GPU device of the process:
///  the `wgpu` instance,
///  device,
///  and queue.
/// Why:
///  `Instance`,
///  `Device`,
///  and `Queue` are cheap handles to the same device,
///  so each window clones them.
///  The struct is leaked in `install_gpu_platform` and never dropped:
///  wgpu's queue reads a thread-local value while it is dropped,
///  and Slint drops its platform while the test thread's thread-locals are being destroyed,
///  which aborts the process ("cannot access a Thread Local Storage value during or after destruction").
///  A test process ends right after its one test,
///  so the leak lasts as long as the process.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type GpuDevice = { instance: GPUInstance; device: GPUDevice; queue: GPUQueue };
/// ```
struct GpuDevice {
    /// The wgpu instance.
    instance: wgpu::Instance,
    /// The hardware device.
    device: wgpu::Device,
    /// The queue of that device.
    queue: wgpu::Queue,
}

/// What:
///  The platform every window of the process is created from;
///  `&'static GpuDevice` is a borrowed reference that lives for the whole process.
/// Why:
///  A leaked device (see `GpuDevice`) can be lent for `'static`,
///  so dropping the platform drops nothing of wgpu.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class GpuPlatform implements Platform { gpu: GpuDevice }
/// ```
struct GpuPlatform {
    /// The leaked device shared by all windows.
    gpu: &'static GpuDevice,
}

impl Platform for GpuPlatform {
    fn create_window_adapter(&self) -> Result<Rc<dyn WindowAdapter>, PlatformError> {
        let renderer = FemtoVGWGPURenderer::new(
            self.gpu.instance.clone(),
            self.gpu.device.clone(),
            self.gpu.queue.clone(),
        )?;
        // What: `Rc::new_cyclic` builds the adapter and lets it hold a weak link to itself, which `Window::new` needs.
        // Why: The window and the adapter refer to each other.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const adapter = new GpuWindow(); adapter.window = new Window(weakRef(adapter));
        // ```
        let adapter: Rc<GpuWindow> = Rc::new_cyclic(|weak| GpuWindow {
            window: Window::new(weak.clone() as _),
            renderer,
            size: Cell::new(PhysicalSize::new(0, 0)),
        });
        return Ok(adapter);
    }
}

/// What:
///  `install_gpu_platform` opens the hardware device,
///  makes a `GpuPlatform` of it,
///  and registers it with Slint for the rest of the process.
///  It returns the adapter's name so a test can print what it ran on.
/// Why:
///  A test calls it first.
///  It panics when there is no hardware adapter or when a platform was installed before,
///  so a test can never silently draw with another renderer.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export function installGpuPlatform(): string { /* throws */ }
/// ```
pub(super) fn install_gpu_platform() -> String {
    let (instance, device, queue, name) =
        open_hardware_device().expect("a hardware Vulkan device for the GPU snapshot harness");
    // What: `Box::new` puts the device on the heap and `Box::leak` gives up ownership, returning a `&'static` reference.
    // Why: Nothing may drop the wgpu handles at thread exit (see `GpuDevice`).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const gpu = new GpuDevice(instance, device, queue); // never released
    // ```
    let gpu: &'static GpuDevice = Box::leak(Box::new(GpuDevice {
        instance,
        device,
        queue,
    }));
    let platform = GpuPlatform { gpu };
    set_platform(Box::new(platform))
        .expect("no Slint platform was installed before the GPU snapshot harness");
    return name;
}

/// The pixels of a window as RGBA bytes (red,
///  green,
///  blue,
///  alpha),
///  row by row from the top,
///  read back from the GPU texture the window was drawn into:
///  the GPU counterpart of the software renderer's `take_snapshot`.
pub(super) fn snapshot(window: &Window) -> SharedPixelBuffer<Rgba8Pixel> {
    return window
        .take_snapshot()
        .expect("a GPU snapshot of the window");
}
