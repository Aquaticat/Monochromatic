//! The adapter choice is decided from adapter descriptions alone,
//!  so these tests need no GPU and no display.

/// The choice and the error under test.
use super::{AdapterSummary, GpuDeviceError, rank_hardware};
/// The adapter kinds.
use slint::wgpu_30::wgpu::DeviceType;

/// An adapter description of the given kind.
fn adapter(name: &str, device_type: DeviceType, driver: &str) -> AdapterSummary {
    return AdapterSummary {
        name: name.to_string(),
        device_type,
        driver: driver.to_string(),
    };
}

#[test]
fn a_machine_that_lists_only_a_cpu_adapter_gets_no_device() {
    let listed = [adapter("llvmpipe (LLVM 19.1.7)", DeviceType::Cpu, "llvmpipe")];
    assert!(
        rank_hardware(&listed).is_empty(),
        "a CPU adapter must never be ranked"
    );
}

#[test]
fn a_cpu_adapter_listed_first_is_skipped_for_the_hardware_one() {
    let listed = [
        adapter("llvmpipe (LLVM 19.1.7)", DeviceType::Cpu, "llvmpipe"),
        adapter("AMD Radeon RX 7600", DeviceType::DiscreteGpu, "radv"),
    ];
    assert_eq!(rank_hardware(&listed), vec![1]);
}

#[test]
fn unknown_and_virtual_kinds_are_not_hardware_either() {
    let listed = [
        adapter("something", DeviceType::Other, "unknown"),
        adapter("virtio", DeviceType::VirtualGpu, "venus"),
    ];
    assert!(rank_hardware(&listed).is_empty());
}

#[test]
fn discrete_gpus_come_before_integrated_ones_and_equal_kinds_keep_their_order() {
    let listed = [
        adapter("Integrated A", DeviceType::IntegratedGpu, "radv"),
        adapter("Discrete A", DeviceType::DiscreteGpu, "radv"),
        adapter("llvmpipe", DeviceType::Cpu, "llvmpipe"),
        adapter("Integrated B", DeviceType::IntegratedGpu, "anv"),
        adapter("Discrete B", DeviceType::DiscreteGpu, "nvidia"),
    ];
    assert_eq!(rank_hardware(&listed), vec![1, 4, 0, 3]);
}

#[test]
fn the_message_without_a_hardware_adapter_names_the_adapters_seen_and_every_remedy() {
    let listed = [adapter("llvmpipe (LLVM 19.1.7)", DeviceType::Cpu, "llvmpipe")];
    let mut seen: Vec<String> = Vec::new();
    for summary in &listed {
        seen.push(summary.to_string());
    }
    let message = GpuDeviceError::NoHardwareAdapter { seen }.to_string();
    for needle in [
        "llvmpipe (LLVM 19.1.7) (Cpu, llvmpipe)",
        "refused on purpose",
        "mesa-vulkan-drivers",
        "vulkan-loader",
        "--device /dev/dri",
        "vulkaninfo --summary",
        "VK_DRIVER_FILES",
    ] {
        assert!(message.contains(needle), "missing {needle:?} in: {message}");
    }
}

#[test]
fn the_message_with_no_adapter_at_all_says_the_loader_found_no_driver() {
    let message = GpuDeviceError::NoHardwareAdapter { seen: Vec::new() }.to_string();
    assert!(message.contains("found no driver at all"), "{message}");
}

#[test]
fn the_message_of_a_refused_device_names_each_adapter_and_its_reason() {
    let message = GpuDeviceError::DeviceRefused {
        refusals: vec![
            "Adapter A: limit max_storage_buffers_per_shader_stage".to_string(),
            "Adapter B: out of memory".to_string(),
        ],
    }
    .to_string();
    for needle in ["Adapter A: limit", "Adapter B: out of memory", "Update the Vulkan driver"] {
        assert!(
            message.to_lowercase().contains(&needle.to_lowercase()),
            "missing {needle:?} in: {message}"
        );
    }
}
