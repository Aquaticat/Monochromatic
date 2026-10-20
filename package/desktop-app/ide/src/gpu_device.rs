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
//!
//! Which hardware adapter:
//!  The candidates are the discrete and integrated GPUs,
//!  in the order the Vulkan loader lists them.
//!  That order is the system's choice:
//!  Mesa documents that without `DRI_PRIME` the default GPU is the one the display server uses,
//!  that `DRI_PRIME` and `MESA_VK_DEVICE_SELECT` put the selected GPU first in the physical device list,
//!  and desktops set these per application through switcheroo-control.
//!  The IDE is a read-only editor,
//!  so it does not rank discrete above integrated and does not wake a second GPU on its own.
//!  Two variables that wgpu documents are honored as explicit choices of the person who started the program:
//!  `WGPU_ADAPTER_NAME` keeps only the hardware adapters whose name contains the value (case-insensitive),
//!  and `WGPU_POWER_PREF` (`low`, `high`, or `none`, case-insensitive) moves the integrated or the discrete GPUs first.
//!  When both are set the name filters and the power preference orders what is left,
//!  as wgpu's own helper lets the name win over the power preference.
//!  An empty value counts as unset.
//!  The reason for the choice is returned with the device so the launcher can log it.

/// The `wgpu` crate as Slint re-exports it,
///  so the device is built with exactly the wgpu release (30) that Slint's renderer was built against.
use slint::wgpu_30::wgpu;
/// Error text for the failures below.
use std::fmt;

/// The name of the variable that picks an adapter by its name,
///  as `wgpu::util::initialize_adapter_from_env` reads it (wgpu 30).
pub const NAME_VARIABLE: &str = "WGPU_ADAPTER_NAME";

/// The name of the variable that orders integrated and discrete GPUs,
///  as `wgpu::PowerPreference::from_env` reads it (wgpu 30).
pub const POWER_VARIABLE: &str = "WGPU_POWER_PREF";

/// The values of `WGPU_POWER_PREF` that wgpu 30 accepts,
///  in the order the error message names them.
pub const POWER_VALUES: &str = "low, high, none";

/// What:
///  Whether a kind of adapter is a candidate:
///  only discrete and integrated GPUs are.
/// Why:
///  Every other kind
///  (the CPU kind above all,
///  but also virtual and unknown ones)
///  is refused,
///  so no CPU adapter is ever chosen.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function isHardware(kind: DeviceType): boolean {
///   return kind === 'DiscreteGpu' || kind === 'IntegratedGpu';
/// }
/// ```
fn is_hardware(kind: wgpu::DeviceType) -> bool {
    return kind == wgpu::DeviceType::DiscreteGpu || kind == wgpu::DeviceType::IntegratedGpu;
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
///  The two variables the person may set to choose an adapter,
///  as text and exactly as read.
///  `Option<String>` is text or nothing (`string | undefined`).
/// Why:
///  The choice is a pure function of these values and the adapter list,
///  so tests pass them in and never read the process environment,
///  and the error messages show what was read.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Variables = { adapterName?: string; powerPreference?: string };
/// ```
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Variables {
    /// The value of `WGPU_ADAPTER_NAME`,
    ///  or nothing when it is unset or empty.
    pub adapter_name: Option<String>,
    /// The value of `WGPU_POWER_PREF`,
    ///  or nothing when it is unset or empty.
    pub power_preference: Option<String>,
}

/// What:
///  `read_variable` reads one environment variable as text;
///  `None` when it is unset or empty.
///  `var_os` returns the raw operating-system string,
///  and `to_string_lossy` turns bytes that are not UTF-8 into replacement characters.
/// Why:
///  An empty value (`WGPU_POWER_PREF= ide`) is how a shell unsets a variable for one command.
///  Bytes that are not UTF-8 then match no adapter name and no power value,
///  so they become an error that names the value,
///  and never silently count as unset.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function readVariable(name: string): string | undefined {
///   const value = process.env[name];
///   return value === '' ? undefined : value;
/// }
/// ```
fn read_variable(name: &str) -> Option<String> {
    let value = std::env::var_os(name)?;
    let text = value.to_string_lossy().into_owned();
    if text.is_empty() {
        return None;
    }
    return Some(text);
}

/// Reads both variables from the process environment.
impl Variables {
    /// What:
    ///  The values of `WGPU_ADAPTER_NAME` and `WGPU_POWER_PREF` now.
    /// Why:
    ///  Only `open_hardware_device` calls it.
    ///  Everything else takes a `Variables` value as an argument.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function fromEnvironment(): Variables;
    /// ```
    pub fn from_environment() -> Self {
        return Self {
            adapter_name: read_variable(NAME_VARIABLE),
            power_preference: read_variable(POWER_VARIABLE),
        };
    }
}

/// Writes which variables were read and what they held.
impl fmt::Display for Variables {
    /// `WGPU_ADAPTER_NAME="x" or not set, WGPU_POWER_PREF="y" or not set`.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write_variable(formatter, NAME_VARIABLE, &self.adapter_name)?;
        write!(formatter, ", ")?;
        return write_variable(formatter, POWER_VARIABLE, &self.power_preference);
    }
}

/// What:
///  Write one variable as `NAME="value"`, or `NAME not set`.
/// Why:
///  `Variables` shows both variables the same way.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function writeVariable(name: string, value: string | undefined): string;
/// ```
fn write_variable(
    formatter: &mut fmt::Formatter<'_>,
    name: &str,
    value: &Option<String>,
) -> fmt::Result {
    return match value {
        Some(text) => write!(formatter, "{name}=\"{text}\""),
        None => write!(formatter, "{name} not set"),
    };
}

/// What:
///  How `WGPU_POWER_PREF` orders the hardware adapters:
///  integrated first,
///  discrete first,
///  or the loader's order.
/// Why:
///  `low`, `high`, and `none` are the three values wgpu 30 accepts;
///  anything else is an error here (wgpu itself ignores it).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PowerOrder = 'integratedFirst' | 'discreteFirst' | 'loaderOrder';
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PowerOrder {
    /// `low`: integrated GPUs before discrete ones.
    IntegratedFirst,
    /// `high`: discrete GPUs before integrated ones.
    DiscreteFirst,
    /// `none`: no preference, the order the Vulkan loader lists.
    LoaderOrder,
}

/// What:
///  Parse a `WGPU_POWER_PREF` value the way `wgpu::PowerPreference::from_env` does
///  (case-insensitive `low`, `high`, `none`),
///  but say so when the value is none of them.
/// Why:
///  wgpu returns nothing for both "unset" and "garbage",
///  so a misspelled variable would silently choose nothing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function parsePowerOrder(value: string): PowerOrder | undefined;
/// ```
fn parse_power_order(value: &str) -> Option<PowerOrder> {
    return match value.to_lowercase().as_str() {
        "low" => Some(PowerOrder::IntegratedFirst),
        "high" => Some(PowerOrder::DiscreteFirst),
        "none" => Some(PowerOrder::LoaderOrder),
        _ => None,
    };
}

/// What:
///  The adapters in the order they are tried,
///  and the facts the reason for the choice is made from.
///  `Vec<usize>` is an array of indexes into the loader's list.
/// Why:
///  The device opens on the first adapter that accepts it,
///  and the launcher logs why that one was first.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type AdapterOrder = { indexes: number[]; variables: Variables; power: PowerOrder | undefined };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AdapterOrder {
    /// Indexes into the loader's list,
    ///  in the order to try them.
    pub indexes: Vec<usize>,
    /// The variables that were read.
    pub variables: Variables,
    /// The parsed `WGPU_POWER_PREF`,
    ///  or nothing when it was not set.
    pub power: Option<PowerOrder>,
}

/// The reason for the choice.
impl AdapterOrder {
    /// What:
    ///  Say in one sentence why the adapter at `position` in this order (index `loader_index` in the loader's list)
    ///  is the one in use.
    /// Why:
    ///  The launcher logs it,
    ///  so a person can see whether the system's order or a variable decided.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function why(position: number, loaderIndex: number): string;
    /// ```
    pub fn why(&self, position: usize, loader_index: usize) -> String {
        let mut parts: Vec<String> = Vec::new();
        if let Some(name) = &self.variables.adapter_name {
            parts.push(format!(
                "{NAME_VARIABLE}=\"{name}\" keeps only the hardware adapters whose name contains it"
            ));
        }
        match self.power {
            Some(PowerOrder::IntegratedFirst) => parts.push(format!(
                "{POWER_VARIABLE}={} puts integrated GPUs first",
                self.variables.power_preference.clone().unwrap_or_default()
            )),
            Some(PowerOrder::DiscreteFirst) => parts.push(format!(
                "{POWER_VARIABLE}={} puts discrete GPUs first",
                self.variables.power_preference.clone().unwrap_or_default()
            )),
            Some(PowerOrder::LoaderOrder) => parts.push(format!(
                "{POWER_VARIABLE}={} keeps the loader's order",
                self.variables.power_preference.clone().unwrap_or_default()
            )),
            None => {}
        }
        if self.variables.adapter_name.is_none()
            && !matches!(
                self.power,
                Some(PowerOrder::IntegratedFirst | PowerOrder::DiscreteFirst)
            )
        {
            parts.push(
                "no variable reordered the adapters, so the system's choice applies: the Vulkan loader's order \
                 (Mesa puts the display server's GPU first, or the one DRI_PRIME or MESA_VK_DEVICE_SELECT names)"
                    .to_string(),
            );
        }
        let mut place = format!(
            "candidate {} of {} (index {} in the loader's list)",
            position + 1,
            self.indexes.len(),
            loader_index
        );
        if position > 0 {
            place.push_str(&format!(
                ", chosen after the {position} before it refused the device"
            ));
        }
        parts.push(place);
        return parts.join("; ");
    }
}

/// What:
///  The candidates with the adapters of one kind moved to the front;
///  each group keeps the loader's order.
/// Why:
///  `WGPU_POWER_PREF=low` and `high` move a kind first and drop nothing,
///  so the other kind stays behind as the next adapter to try.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function kindFirst(adapters: AdapterSummary[], candidates: number[], kind: DeviceType): number[];
/// ```
fn kind_first(
    adapters: &[AdapterSummary],
    candidates: &[usize],
    kind: wgpu::DeviceType,
) -> Vec<usize> {
    let mut front: Vec<usize> = Vec::new();
    let mut back: Vec<usize> = Vec::new();
    for index in candidates {
        if adapters[*index].device_type == kind {
            front.push(*index);
        } else {
            back.push(*index);
        }
    }
    front.extend(back);
    return front;
}

/// What:
///  `choose_adapters` decides which adapters may be used and in which order.
///  `&[T]` is a borrowed slice (a read-only view of an array).
///  `Result<T, E>` is a value or an error (a function that may throw).
/// Why:
///  The candidates are the hardware adapters (discrete and integrated) in the loader's order.
///  `WGPU_ADAPTER_NAME` keeps those whose name contains the value (case-insensitive),
///  and `WGPU_POWER_PREF` moves integrated (`low`) or discrete (`high`) GPUs first,
///  both without dropping the rest.
///  A machine that lists only CPU adapters gets an error,
///  never its first adapter,
///  and a name that matches only a CPU,
///  virtual,
///  or unknown adapter gets one too.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function chooseAdapters(adapters: AdapterSummary[], variables: Variables): AdapterOrder; // throws GpuDeviceError
/// ```
pub fn choose_adapters(
    adapters: &[AdapterSummary],
    variables: &Variables,
) -> Result<AdapterOrder, GpuDeviceError> {
    let power = match &variables.power_preference {
        None => None,
        Some(value) => match parse_power_order(value) {
            Some(order) => Some(order),
            None => {
                return Err(GpuDeviceError::BadPowerPreference {
                    value: value.clone(),
                });
            }
        },
    };
    // The name keeps the adapters whose lowercase name contains the lowercase value, as wgpu's helper does.
    let mut matching: Vec<usize> = Vec::new();
    for (index, adapter) in adapters.iter().enumerate() {
        let named = match &variables.adapter_name {
            None => true,
            Some(wanted) => adapter.name.to_lowercase().contains(&wanted.to_lowercase()),
        };
        if named {
            matching.push(index);
        }
    }
    let mut candidates: Vec<usize> = Vec::new();
    let mut refused_kinds: Vec<String> = Vec::new();
    for index in matching {
        if is_hardware(adapters[index].device_type) {
            candidates.push(index);
        } else {
            refused_kinds.push(adapters[index].to_string());
        }
    }
    if candidates.is_empty() {
        let report = SelectionReport::new(adapters, &[], variables.clone());
        if variables.adapter_name.is_none() {
            return Err(GpuDeviceError::NoHardwareAdapter { report });
        }
        if refused_kinds.is_empty() {
            return Err(GpuDeviceError::AdapterNameUnmatched { report });
        }
        return Err(GpuDeviceError::AdapterNameMatchesOnlyRefusedKinds {
            report,
            matched: refused_kinds,
        });
    }
    match power {
        Some(PowerOrder::IntegratedFirst) => {
            candidates = kind_first(adapters, &candidates, wgpu::DeviceType::IntegratedGpu);
        }
        Some(PowerOrder::DiscreteFirst) => {
            candidates = kind_first(adapters, &candidates, wgpu::DeviceType::DiscreteGpu);
        }
        Some(PowerOrder::LoaderOrder) | None => {}
    }
    return Ok(AdapterOrder {
        indexes: candidates,
        variables: variables.clone(),
        power,
    });
}

/// What:
///  What the choice saw,
///  for the error messages:
///  every adapter listed,
///  the order that was used,
///  and the variables that were read.
/// Why:
///  A failure must let the person see whether the machine,
///  the order,
///  or a variable they set is the cause.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type SelectionReport = { seen: string[]; order: string[]; variables: Variables };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SelectionReport {
    /// Every Vulkan adapter that was listed,
    ///  in the loader's order,
    ///  each as `name (kind, driver)`;
    ///  empty when the loader found no driver at all.
    pub seen: Vec<String>,
    /// The adapters that were tried,
    ///  in the order used;
    ///  empty when no adapter qualified.
    pub order: Vec<String>,
    /// The variables that were read.
    pub variables: Variables,
}

/// Every adapter name list is written the same way in every message.
fn listing(names: &[String]) -> String {
    if names.is_empty() {
        return "none".to_string();
    }
    return names.join(", ");
}

/// The common tail of the messages that concern the choice.
impl SelectionReport {
    /// What:
    ///  Describe every listed adapter,
    ///  and the adapters at `order` (indexes into the list) in that order.
    /// Why:
    ///  The same description serves every error that concerns the choice.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function newReport(adapters: AdapterSummary[], order: number[], variables: Variables): SelectionReport;
    /// ```
    pub fn new(adapters: &[AdapterSummary], order: &[usize], variables: Variables) -> Self {
        let mut seen: Vec<String> = Vec::new();
        for adapter in adapters {
            seen.push(adapter.to_string());
        }
        let mut used: Vec<String> = Vec::new();
        for index in order {
            used.push(adapters[*index].to_string());
        }
        return Self {
            seen,
            order: used,
            variables,
        };
    }

    /// What:
    ///  The sentence block with the adapters seen,
    ///  the order used,
    ///  the variables read,
    ///  and how to choose a GPU.
    /// Why:
    ///  Each choice error ends with it,
    ///  so every message names every remedy.
    fn details(&self) -> String {
        let seen = if self.seen.is_empty() {
            "none (the Vulkan loader found no driver at all)".to_string()
        } else {
            listing(&self.seen)
        };
        return format!(
            "Adapters seen, in the Vulkan loader's order: {seen}. \
             Order used: {}. \
             Variables read: {}. \
             Without a variable the IDE uses the first hardware adapter the loader lists, \
             which on a Mesa system is the GPU the display server uses. \
             To choose a GPU yourself: set {NAME_VARIABLE} to part of the adapter's name (case-insensitive, such as RADV); \
             set {POWER_VARIABLE} to low (integrated GPU first), high (discrete GPU first), or none (the loader's order); \
             or set DRI_PRIME (for example DRI_PRIME=1) or MESA_VK_DEVICE_SELECT (vendor_id:device_id, \
             as MESA_VK_DEVICE_SELECT=list prints) so that Mesa puts that GPU first in the Vulkan list.",
            listing(&self.order),
            self.variables
        );
    }
}

/// What:
///  Turn the operating system's failure to build the small runtime into this module's error.
/// Why:
///  `map_err` takes it by name.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function noRuntime(error: Error): GpuDeviceError;
/// ```
fn no_runtime(error: std::io::Error) -> GpuDeviceError {
    return GpuDeviceError::NoRuntime(error.to_string());
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
///   | { kind: 'noHardwareAdapter'; report: SelectionReport }
///   | { kind: 'adapterNameUnmatched'; report: SelectionReport }
///   | { kind: 'adapterNameMatchesOnlyRefusedKinds'; report: SelectionReport; matched: string[] }
///   | { kind: 'badPowerPreference'; value: string }
///   | { kind: 'deviceRefused'; refusals: string[]; report: SelectionReport };
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
        /// What was listed and read.
        report: SelectionReport,
    },
    /// `WGPU_ADAPTER_NAME` matches the name of no adapter at all.
    AdapterNameUnmatched {
        /// What was listed and read.
        report: SelectionReport,
    },
    /// `WGPU_ADAPTER_NAME` matches only adapters of kinds that are refused (CPU,
    ///  virtual,
    ///  unknown).
    AdapterNameMatchesOnlyRefusedKinds {
        /// What was listed and read.
        report: SelectionReport,
        /// The matching adapters,
        ///  each as `name (kind, driver)`.
        matched: Vec<String>,
    },
    /// `WGPU_POWER_PREF` holds something other than `low`,
    ///  `high`,
    ///  or `none`.
    BadPowerPreference {
        /// The value as read.
        value: String,
    },
    /// Hardware adapters exist and every one of them refused the device.
    DeviceRefused {
        /// One entry per adapter:
        ///  its name and the reason it gave.
        refusals: Vec<String>,
        /// What was listed and read,
        ///  with the order that was tried.
        report: SelectionReport,
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
            Self::NoHardwareAdapter { report } => write!(
                formatter,
                "The IDE draws every pixel on the GPU through Vulkan, and no hardware Vulkan adapter is available. \
                 {} \
                 An adapter of the CPU kind (lavapipe, llvmpipe) is refused on purpose, even when it is the only one, \
                 and SLINT_WGPU_CPU does not allow it here. \
                 Remedies: install the Vulkan driver of the GPU (the Mesa Vulkan package such as mesa-vulkan-drivers \
                 for AMD and Intel, the vendor driver for NVIDIA) together with the Vulkan loader \
                 (vulkan-loader or libvulkan1); \
                 give the process access to the GPU's render node (/dev/dri/renderD128 and its siblings: \
                 join the render group, or in a container pass --device /dev/dri and install the driver in the image); \
                 run `vulkaninfo --summary` to see what the loader finds; \
                 and if VK_DRIVER_FILES or VK_ICD_FILENAMES is set, make it name the driver file of a hardware GPU.",
                report.details()
            ),
            Self::AdapterNameUnmatched { report } => write!(
                formatter,
                "{NAME_VARIABLE} is set, and its value matches the name of no Vulkan adapter. \
                 {} \
                 Remedies: unset {NAME_VARIABLE}, or set it to part of one of the names above \
                 (the match ignores case); `vulkaninfo --summary` shows the names the loader reports.",
                report.details()
            ),
            Self::AdapterNameMatchesOnlyRefusedKinds { report, matched } => write!(
                formatter,
                "{NAME_VARIABLE} is set, and it matches only adapters that the IDE refuses on purpose: {}. \
                 The IDE never draws on the CPU, so an adapter of the CPU, virtual, or unknown kind is not used \
                 even when the name asks for it, and SLINT_WGPU_CPU does not allow it here. \
                 {} \
                 Remedies: unset {NAME_VARIABLE}, or set it to part of the name of a discrete or integrated GPU.",
                listing(matched),
                report.details()
            ),
            Self::BadPowerPreference { value } => write!(
                formatter,
                "{POWER_VARIABLE} is set to \"{value}\", which wgpu does not accept. \
                 The accepted values are {POWER_VALUES} (case-insensitive): low puts the integrated GPU first, \
                 high puts the discrete GPU first, and none keeps the order of the Vulkan loader. \
                 Remedies: unset {POWER_VARIABLE} or set it to one of those values; \
                 to choose a GPU by name set {NAME_VARIABLE}, \
                 or set DRI_PRIME or MESA_VK_DEVICE_SELECT so that Mesa puts the GPU you want first in the Vulkan list."
            ),
            Self::DeviceRefused { refusals, report } => write!(
                formatter,
                "A hardware Vulkan adapter was found, but none of them gave the IDE a device with wgpu's default limits \
                 (storage buffers and 8192-pixel textures among them, which the GPU text path needs): {}. \
                 {} \
                 Remedies: update the Vulkan driver (Mesa or the vendor driver) of the GPU, \
                 or run the IDE on a host whose GPU supports the Vulkan 1.1 level that wgpu requires; \
                 `vulkaninfo --summary` shows the driver version and the API version each adapter reports.",
                refusals.join("; "),
                report.details()
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
/// type HardwareDevice = { instance: GPUInstance; adapter: GPUAdapter; device: GPUDevice; queue: GPUQueue; summary: AdapterSummary; why: string };
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
    /// Why this adapter was used:
    ///  the loader's order,
    ///  or the variable that decided.
    pub why: String,
}

/// What:
///  `open_hardware_device` opens a Vulkan device on the first hardware adapter, in the order of `choose_adapters`,
///  that accepts wgpu's default limits.
///  It reads `WGPU_ADAPTER_NAME` and `WGPU_POWER_PREF` from the process environment.
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
    // What: the two variables, read once, before any GPU work.
    // Why: a misspelled `WGPU_POWER_PREF` should fail without touching a driver.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const variables = { adapterName: env.WGPU_ADAPTER_NAME, powerPreference: env.WGPU_POWER_PREF };
    // ```
    let variables = Variables::from_environment();
    if let Some(value) = &variables.power_preference
        && parse_power_order(value).is_none()
    {
        return Err(GpuDeviceError::BadPowerPreference {
            value: value.clone(),
        });
    }
    // What: a current-thread tokio runtime runs the two wgpu futures to completion; `map_err` turns its error into ours.
    // Why: wgpu's adapter and device requests are async; tokio is already a dependency of the application.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const runtime = new Runtime(); // throws GpuDeviceError on failure
    // ```
    let runtime = tokio::runtime::Builder::new_current_thread()
        .build()
        .map_err(no_runtime)?;
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
    // What: every Vulkan adapter, as an owned list in the loader's order, and what each one says about itself.
    // Why: the choice needs all of them, and the failure message names them.
    //      wgpu 30 does not sort this list when no power preference is given to it.
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
    let choice = choose_adapters(&summaries, &variables)?;
    // What: try the adapters in the chosen order; the first that gives a device wins.
    // Why: an integrated GPU with the limits is better than a discrete one without them, and the refusals are reported.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const index of order) { try { return await open(adapters[index]); } catch (error) { refusals.push(...); } }
    // ```
    let mut refusals: Vec<String> = Vec::new();
    for (position, index) in choice.indexes.iter().copied().enumerate() {
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
                    why: choice.why(position, index),
                });
            }
            Err(error) => {
                tracing::warn!(adapter = %summary, %error, "a hardware adapter refused the device");
                refusals.push(format!("{}: {error}", summary.name));
            }
        }
    }
    let report = SelectionReport::new(&summaries, &choice.indexes, variables);
    return Err(GpuDeviceError::DeviceRefused { refusals, report });
}

/// The adapter choice and the messages of the errors are checked from adapter descriptions alone.
#[cfg(test)]
#[path = "gpu_device_tests.rs"]
mod tests;
