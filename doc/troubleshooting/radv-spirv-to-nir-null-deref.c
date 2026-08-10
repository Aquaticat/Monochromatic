/*
 * Minimal reproduction: RADV dereferences the NULL returned by spirv_to_nir().
 *
 * Feeds one SPIR-V compute module to vkCreateComputePipelines. When the module
 * fails SPIR-V -> NIR translation, radv_shader_spirv_to_nir() (radv_shader.c:543)
 * writes through the NULL return value instead of propagating an error, so the
 * process dies with SIGSEGV writing to 0x40 rather than returning a VkResult.
 *
 * Build: gcc -O0 -g -o radv-spirv-null-repro radv-spirv-null-repro.c -lvulkan
 * Run:   ./radv-spirv-null-repro <module.spv>
 */

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <vulkan/vulkan.h>

#define CHECK(expr)                                                                                \
   do {                                                                                            \
      VkResult check_result = (expr);                                                              \
      if (check_result != VK_SUCCESS) {                                                            \
         fprintf(stderr, "%s failed: VkResult %d\n", #expr, (int)check_result);                    \
         return EXIT_FAILURE;                                                                      \
      }                                                                                            \
   } while (0)

#define DESCRIPTOR_SET_COUNT 3
#define BINDINGS_PER_SET 2
#define DESCRIPTOR_ARRAY_SIZE 64
#define PUSH_CONSTANT_BYTES 256

static uint32_t *
read_spirv(const char *path, size_t *out_bytes)
{
   FILE *file = fopen(path, "rb");
   if (!file) {
      fprintf(stderr, "cannot open %s\n", path);
      return NULL;
   }

   fseek(file, 0, SEEK_END);
   long size = ftell(file);
   fseek(file, 0, SEEK_SET);

   uint32_t *words = malloc((size_t)size);
   if (!words || fread(words, 1, (size_t)size, file) != (size_t)size) {
      fprintf(stderr, "cannot read %s\n", path);
      fclose(file);
      free(words);
      return NULL;
   }

   fclose(file);
   *out_bytes = (size_t)size;
   return words;
}

int
main(int argc, char **argv)
{
   if (argc != 2) {
      fprintf(stderr, "usage: %s <module.spv>\n", argv[0]);
      return EXIT_FAILURE;
   }

   size_t spirv_bytes = 0;
   uint32_t *spirv = read_spirv(argv[1], &spirv_bytes);
   if (!spirv)
      return EXIT_FAILURE;

   VkApplicationInfo app_info = {
      .sType = VK_STRUCTURE_TYPE_APPLICATION_INFO,
      .pApplicationName = "radv-spirv-null-repro",
      .apiVersion = VK_API_VERSION_1_3,
   };
   VkInstanceCreateInfo instance_info = {
      .sType = VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO,
      .pApplicationInfo = &app_info,
   };

   VkInstance instance;
   CHECK(vkCreateInstance(&instance_info, NULL, &instance));

   uint32_t device_count = 0;
   CHECK(vkEnumeratePhysicalDevices(instance, &device_count, NULL));
   if (device_count == 0) {
      fprintf(stderr, "no Vulkan devices\n");
      return EXIT_FAILURE;
   }

   VkPhysicalDevice *devices = calloc(device_count, sizeof(*devices));
   CHECK(vkEnumeratePhysicalDevices(instance, &device_count, devices));

   VkPhysicalDevice physical_device = devices[0];
   VkPhysicalDeviceProperties props;
   vkGetPhysicalDeviceProperties(physical_device, &props);
   printf("device: %s (driver %u)\n", props.deviceName, props.driverVersion);

   uint32_t family_count = 0;
   vkGetPhysicalDeviceQueueFamilyProperties(physical_device, &family_count, NULL);
   VkQueueFamilyProperties *families = calloc(family_count, sizeof(*families));
   vkGetPhysicalDeviceQueueFamilyProperties(physical_device, &family_count, families);

   uint32_t compute_family = UINT32_MAX;
   for (uint32_t i = 0; i < family_count; i++) {
      if (families[i].queueFlags & VK_QUEUE_COMPUTE_BIT) {
         compute_family = i;
         break;
      }
   }
   if (compute_family == UINT32_MAX) {
      fprintf(stderr, "no compute queue family\n");
      return EXIT_FAILURE;
   }

   float queue_priority = 1.0f;
   VkDeviceQueueCreateInfo queue_info = {
      .sType = VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO,
      .queueFamilyIndex = compute_family,
      .queueCount = 1,
      .pQueuePriorities = &queue_priority,
   };

   /* The module declares RuntimeDescriptorArray, SampledImageArrayDynamicIndexing
    * and PhysicalStorageBufferAddresses, so the device must expose them or
    * pipeline creation is rejected before the shader is ever translated. */
   VkPhysicalDeviceVulkan12Features features12 = {
      .sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_VULKAN_1_2_FEATURES,
      .descriptorIndexing = VK_TRUE,
      .runtimeDescriptorArray = VK_TRUE,
      .descriptorBindingPartiallyBound = VK_TRUE,
      .descriptorBindingVariableDescriptorCount = VK_TRUE,
      .shaderSampledImageArrayNonUniformIndexing = VK_TRUE,
      .shaderStorageBufferArrayNonUniformIndexing = VK_TRUE,
      .bufferDeviceAddress = VK_TRUE,
   };
   VkPhysicalDeviceFeatures2 features = {
      .sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_FEATURES_2,
      .pNext = &features12,
      .features = {.shaderSampledImageArrayDynamicIndexing = VK_TRUE,
                   .shaderStorageBufferArrayDynamicIndexing = VK_TRUE},
   };
   VkDeviceCreateInfo device_info = {
      .sType = VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO,
      .pNext = &features,
      .queueCreateInfoCount = 1,
      .pQueueCreateInfos = &queue_info,
   };

   VkDevice device;
   CHECK(vkCreateDevice(physical_device, &device_info, NULL, &device));

   /* The module references sets 0-2, bindings 0-1. Exact descriptor types do not
    * matter: the crash happens during SPIR-V translation, before the layout is
    * consulted. */
   VkDescriptorSetLayout set_layouts[DESCRIPTOR_SET_COUNT];
   for (uint32_t set = 0; set < DESCRIPTOR_SET_COUNT; set++) {
      VkDescriptorSetLayoutBinding bindings[BINDINGS_PER_SET] = {
         {.binding = 0,
          .descriptorType = VK_DESCRIPTOR_TYPE_STORAGE_BUFFER,
          .descriptorCount = DESCRIPTOR_ARRAY_SIZE,
          .stageFlags = VK_SHADER_STAGE_COMPUTE_BIT},
         {.binding = 1,
          .descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER,
          .descriptorCount = DESCRIPTOR_ARRAY_SIZE,
          .stageFlags = VK_SHADER_STAGE_COMPUTE_BIT},
      };
      VkDescriptorSetLayoutCreateInfo set_info = {
         .sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_LAYOUT_CREATE_INFO,
         .bindingCount = BINDINGS_PER_SET,
         .pBindings = bindings,
      };
      CHECK(vkCreateDescriptorSetLayout(device, &set_info, NULL, &set_layouts[set]));
   }

   VkPushConstantRange push_range = {
      .stageFlags = VK_SHADER_STAGE_COMPUTE_BIT,
      .offset = 0,
      .size = PUSH_CONSTANT_BYTES,
   };
   VkPipelineLayoutCreateInfo layout_info = {
      .sType = VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO,
      .setLayoutCount = DESCRIPTOR_SET_COUNT,
      .pSetLayouts = set_layouts,
      .pushConstantRangeCount = 1,
      .pPushConstantRanges = &push_range,
   };

   VkPipelineLayout pipeline_layout;
   CHECK(vkCreatePipelineLayout(device, &layout_info, NULL, &pipeline_layout));

   VkShaderModuleCreateInfo module_info = {
      .sType = VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO,
      .codeSize = spirv_bytes,
      .pCode = spirv,
   };
   VkShaderModule module;
   CHECK(vkCreateShaderModule(device, &module_info, NULL, &module));

   VkComputePipelineCreateInfo pipeline_info = {
      .sType = VK_STRUCTURE_TYPE_COMPUTE_PIPELINE_CREATE_INFO,
      .stage =
         {
            .sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO,
            .stage = VK_SHADER_STAGE_COMPUTE_BIT,
            .module = module,
            .pName = "main",
         },
      .layout = pipeline_layout,
   };

   printf("calling vkCreateComputePipelines...\n");
   fflush(stdout);

   VkPipeline pipeline = VK_NULL_HANDLE;
   VkResult result =
      vkCreateComputePipelines(device, VK_NULL_HANDLE, 1, &pipeline_info, NULL, &pipeline);

   printf("survived: VkResult %d (expected a clean error, not a crash)\n", (int)result);
   return result == VK_SUCCESS ? EXIT_SUCCESS : EXIT_FAILURE;
}
