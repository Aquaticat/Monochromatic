//! The one GPU device of the process:
//!  a hardware Vulkan adapter with wgpu's full default limits,
//!  chosen by the application and never by Slint.
//!
//! The application and the native test harness (`native/gpu_snapshot.rs`) open their device here,
//!  so both refuse the same adapters.
//!  Nothing in the IDE paints on the CPU (owner decision of 2026-10-19),
//!  and a CPU adapter such as lavapipe (`llvmpipe`) would be exactly that,
//!  so it is never chosen and never a fallback.
//!  Slint cannot give that guarantee:
//!  with no power preference wgpu does not sort the adapters it lists,
//!  and Slint's own check only asks that some adapter is not of the CPU kind.

/// The `wgpu` crate as Slint re-exports it,
///  so the device is built with exactly the wgpu release (30) that Slint's renderer was built against.
use slint::wgpu_30::wgpu;
/// Error text for the failures below.
use std::fmt;

/// What:
///  `hardware_rank` scores a `wgpu::DeviceType` for adapter choice;
///  `Option<u32>` is "a number or nothing" (`number | undefined`).
/// Why:
///  A discrete GPU is preferred over an integrated one,
///  and every other kind (the CPU kind above all, but also virtual and unknown ones) is refused by returning nothing.
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
///  What an adapter reports about itself,
///  as far as the choice and the error messages need it.
/// Why:
///  The choice is a pure function of these values,
///  so it is tested without a GPU.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type AdapterSummary = { name: string; deviceType: DeviceType; driver: string };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AdapterSummary {
    /// The adapter's name,
    ///  such as `AMD Radeon RX 7600 (RADV NAVI33)`.
    pub name: String,
    /// The kind of device the driver reports.
    pub device_type: wgpu::DeviceType,
    /// The driver's name,
    ///  such as `radv` or `llvmpipe`.
    pub driver: String,
}

/// Writes an adapter the way the error messages list it.
impl fmt::Display for AdapterSummary {
    /// `name (kind, driver)`.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        return write!(
            formatter,
            "{} ({:?}, {})",
            self.name, self.device_type, self.driver
        );
    }
}

/// What:
///  The indexes of the adapters the application may use,
///  best first:
///  discrete GPUs,
///  then integrated ones,
///  each group in the order the Vulkan loader listed them.
///  `&[T]` is a borrowed slice (a read-only view of an array).
/// Why:
///  A machine that lists only CPU adapters gets an empty answer,
///  never its first adapter.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function rankHardware(adapters: AdapterSummary[]): number[];
/// ```
pub fn rank_hardware(adapters: &[AdapterSummary]) -> Vec<usize> {
    let mut ranked: Vec<(u32, usize)> = Vec::new();
    for (index, adapter) in adapters.iter().enumerate() {
        if let Some(rank) = hardware_rank(adapter.device_type) {
            ranked.push((rank, index));
        }
    }
    // Higher rank first; equal ranks keep the order of the listing.
    ranked.sort_by(|left, right| return right.0.cmp(&left.0).then(left.1.cmp(&right.1)));
    let mut order: Vec<usize> = Vec::new();
    for (_, index) in ranked {
        order.push(index);
    }
    return order;
}

/// What:
///  Why no device could be opened.
///  An enum is a value that is exactly one of its variants (a TS discriminated union).
/// Why:
///  The caller shows the message to the person who started the program,
///  so each variant says what was seen and every way to fix it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type GpuDeviceError =
///   | { kind: 'noRuntime'; reason: string }
///   | { kind: 'noHardwareAdapter'; seen: string[] }
///   | { kind: 'deviceRefused'; refusals: string[] };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum GpuDeviceError {
    /// The small runtime that waits for wgpu's two futures could not be built.
    NoRuntime(
        /// The operating system's reason.
        String,
    ),
    /// Vulkan lists no discrete or integrated GPU.
    NoHardwareAdapter {
        /// Every Vulkan adapter that was listed,
        ///  each as `name (kind, driver)`;
        ///  empty when the loader found no driver at all.
        seen: Vec<String>,
    },
    /// Hardware adapters exist and every one of them refused the device.
    DeviceRefused {
        /// One entry per adapter:
        ///  its name and the reason it gave.
        refusals: Vec<String>,
    },
}

/// The sentence shown to the person who started the program.
impl fmt::Display for GpuDeviceError {
    /// Writes the problem,
    ///  what was seen,
    ///  and every remedy.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        return match self {
            Self::NoRuntime(reason) => write!(
                formatter,
                "The IDE could not start the small runtime that opens the GPU device: {reason}. \
                 Close other programs to free threads and memory, then start the IDE again."
            ),
            Self::NoHardwareAdapter { seen } => {
                let listing = if seen.is_empty() {
                    "none (the Vulkan loader found no driver at all)".to_string()
                } else {
                    seen.join(", ")
                };
                write!(
                    formatter,
                    "The IDE draws every pixel on the GPU through Vulkan, and no hardware Vulkan adapter is available. \
                     Adapters seen: {listing}. \
                     An adapter of the CPU kind (lavapipe, llvmpipe) is refused on purpose, even when it is the only one, \
                     and SLINT_WGPU_CPU does not allow it here. \
                     Remedies: install the Vulkan driver of the GPU (the Mesa Vulkan package such as mesa-vulkan-drivers \
                     for AMD and Intel, the vendor driver for NVIDIA) together with the Vulkan loader \
                     (vulkan-loader or libvulkan1); \
                     give the process access to the GPU's render node (/dev/dri/renderD128 and its siblings: \
                     join the render group, or in a container pass --device /dev/dri and install the driver in the image); \
                     run `vulkaninfo --summary` to see what the loader finds; \
                     and if VK_DRIVER_FILES or VK_ICD_FILENAMES is set, make it name the driver file of a hardware GPU."
                )
            }
            Self::DeviceRefused { refusals } => write!(
                formatter,
                "A hardware Vulkan adapter was found, but none of them gave the IDE a device with wgpu's default limits \
                 (storage buffers and 8192-pixel textures among them, which the GPU text path needs): {}. \
                 Remedies: update the Vulkan driver (Mesa or the vendor driver) of the GPU, \
                 or run the IDE on a host whose GPU supports the Vulkan 1.1 level that wgpu requires; \
                 `vulkaninfo --summary` shows the driver version and the API version each adapter reports.",
                refusals.join("; ")
            ),
        };
    }
}

/// Lets `?` carry this error into `anyhow::Error` and lets callers use it as a standard error.
impl std::error::Error for GpuDeviceError {}

/// What:
///  The opened device:
///  the wgpu instance,
///  the chosen adapter,
///  and the device and queue made from it.
/// Why:
///  Slint takes all four to render on a device the application opened
///  (`WGPUConfiguration::Manual`),
///  and the harness hands the instance,
///  device,
///  and queue to its renderer.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type HardwareDevice = { instance: GPUInstance; adapter: GPUAdapter; device: GPUDevice; queue: GPUQueue; summary: AdapterSummary };
/// ```
pub struct HardwareDevice {
    /// The instance that lists only Vulkan adapters.
    pub instance: wgpu::Instance,
    /// The chosen hardware adapter.
    pub adapter: wgpu::Adapter,
    /// The device,
    ///  with wgpu's default limits raised to what the adapter allows for image sizes.
    pub device: wgpu::Device,
    /// The queue of that device.
    pub queue: wgpu::Queue,
    /// What the adapter reported about itself.
    pub summary: AdapterSummary,
}

/// What:
///  `open_hardware_device` opens a Vulkan device on the best hardware adapter that accepts wgpu's default limits.
///  `Result<T, E>` is a value or an error (a function that may throw).
///  `Vec` is a growable array.
/// Why:
///  The device must have full limits (`wgpu::Limits::default()` raised to the adapter's resolution limits,
///  as Slint does for its own device),
///  because Vello's compute shaders need storage buffers,
///  which Slint's downlevel default limits forbid.
///  Only the Vulkan backend is asked for,
///  because Slint keeps the GL backend away from wgpu too.
///  A machine with no hardware adapter fails with the list of the adapters it has,
///  and never falls back to a CPU one.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function openHardwareDevice(): HardwareDevice; // throws GpuDeviceError
/// ```
pub fn open_hardware_device() -> Result<HardwareDevice, GpuDeviceError> {
    // What: a current-thread tokio runtime runs the two wgpu futures to completion; `map_err` turns its error into ours.
    // Why: wgpu's adapter and device requests are async; tokio is already a dependency of the application.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const runtime = new Runtime(); // throws GpuDeviceError on failure
    // ```
    let runtime = tokio::runtime::Builder::new_current_thread()
        .build()
        .map_err(|error| return GpuDeviceError::NoRuntime(error.to_string()))?;
    // What: an instance that may open only the Vulkan backend (not GL), with default flags and options.
    // Why: wgpu documents the display handle as unused on Vulkan, and Slint's own automatic path passes none either.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const instance = new GPUInstance({ backends: ['vulkan'] });
    // ```
    let mut description = wgpu::InstanceDescriptor::new_without_display_handle();
    description.backends = wgpu::Backends::VULKAN;
    let instance = wgpu::Instance::new(description);
    // What: every Vulkan adapter, as an owned list, and what each one says about itself.
    // Why: the choice needs all of them, and the failure message names them.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const adapters = await instance.enumerateAdapters('vulkan');
    // ```
    let adapters = runtime.block_on(instance.enumerate_adapters(wgpu::Backends::VULKAN));
    let mut summaries: Vec<AdapterSummary> = Vec::new();
    for adapter in &adapters {
        let info = adapter.get_info();
        summaries.push(AdapterSummary {
            name: info.name,
            device_type: info.device_type,
            driver: info.driver,
        });
    }
    let order = rank_hardware(&summaries);
    if order.is_empty() {
        let mut seen: Vec<String> = Vec::new();
        for summary in &summaries {
            seen.push(summary.to_string());
        }
        return Err(GpuDeviceError::NoHardwareAdapter { seen });
    }
    // What: try the adapters best first; the first that gives a device wins.
    // Why: an integrated GPU with the limits is better than a discrete one without them, and the refusals are reported.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const index of order) { try { return await open(adapters[index]); } catch (error) { refusals.push(...); } }
    // ```
    let mut refusals: Vec<String> = Vec::new();
    for index in order {
        let adapter = adapters[index].clone();
        let summary = summaries[index].clone();
        let limits = wgpu::Limits::default().using_resolution(adapter.limits());
        let device_description = wgpu::DeviceDescriptor {
            label: Some("ide gpu device"),
            required_limits: limits,
            ..wgpu::DeviceDescriptor::default()
        };
        match runtime.block_on(adapter.request_device(&device_description)) {
            Ok((device, queue)) => {
                return Ok(HardwareDevice {
                    instance,
                    adapter,
                    device,
                    queue,
                    summary,
                });
            }
            Err(error) => {
                tracing::warn!(adapter = %summary, %error, "a hardware adapter refused the device");
                refusals.push(format!("{}: {error}", summary.name));
            }
        }
    }
    return Err(GpuDeviceError::DeviceRefused { refusals });
}

#[cfg(test)]
#[path = "gpu_device_tests.rs"]
mod tests;
