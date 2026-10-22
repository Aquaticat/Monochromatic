/**
 Checked-in NeuralWatt listing snapshot: the model facts served while the
 mount fetch cannot reach the endpoint. @module
 */

import type { NeuralWattListingEntry, } from './listing.ts';

//region Public API

/**
 Reduced listing snapshot fetched from GET
 `https://api.neuralwatt.com/v1/models` on 2026-10-22: every entry the
 endpoint returned then, keeping only the fields the mapping reads (id,
 display name, capabilities, reasoning efforts, token limits, deprecation).
 Pricing and descriptive fields are dropped on purpose: this provider
 serves models, it does not estimate cost.
 */
export const neuralWattListingSnapshot: readonly NeuralWattListingEntry[] = [
  {
    id: 'qwen-3.8-27b',
    max_model_len: 262128,
    metadata: {
      display_name: 'Qwen 3.8 27B',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['xhigh', 'medium', 'low', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          max: 'xhigh',
          high: 'xhigh',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 262128,
        max_output_tokens: 131072,
      },
    },
  },
  {
    id: 'qwen-3.8-27b-flex',
    max_model_len: 262128,
    metadata: {
      display_name: 'Qwen 3.8 27B (flex)',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['xhigh', 'medium', 'low', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          max: 'xhigh',
          high: 'xhigh',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 262128,
        max_output_tokens: 131072,
      },
    },
  },
  {
    id: 'mimo-v2.6-pro',
    max_model_len: 1048560,
    metadata: {
      display_name: 'MiMo-V2.6-Pro',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['high', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          max: 'high',
          xhigh: 'high',
          medium: 'high',
          low: 'high',
          minimal: 'none',
        },
      },
      limits: {
        max_context_length: 1048560,
        max_output_tokens: 393216,
      },
    },
  },
  {
    id: 'mimo-v2.6-pro-flex',
    max_model_len: 1048560,
    metadata: {
      display_name: 'MiMo-V2.6-Pro (flex)',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['high', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          max: 'high',
          xhigh: 'high',
          medium: 'high',
          low: 'high',
          minimal: 'none',
        },
      },
      limits: {
        max_context_length: 1048560,
        max_output_tokens: 393216,
      },
    },
  },
  {
    id: 'nw-large',
    max_model_len: 1048560,
    metadata: {
      display_name: 'Neuralwatt Large',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['max', 'high', 'low', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          xhigh: 'max',
          medium: 'high',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 1048560,
      },
    },
  },
  {
    id: 'nw-large-flex',
    max_model_len: 1048560,
    metadata: {
      display_name: 'Neuralwatt Large (flex)',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['max', 'high', 'low', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          xhigh: 'max',
          medium: 'high',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 1048560,
      },
    },
  },
  {
    id: 'nw-flash',
    max_model_len: 1048560,
    metadata: {
      display_name: 'Neuralwatt Flash',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['max', 'xhigh', 'high', 'low', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          medium: 'high',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 1048560,
        max_output_tokens: 393216,
      },
    },
  },
  {
    id: 'nw-flash-flex',
    max_model_len: 1048560,
    metadata: {
      display_name: 'Neuralwatt Flash (flex)',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['max', 'xhigh', 'high', 'low', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          medium: 'high',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 1048560,
        max_output_tokens: 393216,
      },
    },
  },
  {
    id: 'glm-5.3',
    max_model_len: 1048560,
    metadata: {
      display_name: 'GLM 5.3',
      capabilities: {
        reasoning: true,
        vision: false,
      },
      reasoning: {
        supported_efforts: ['max', 'high', 'low',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal',],
        effort_aliases: {
          xhigh: 'max',
          medium: 'high',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 1048560,
      },
    },
  },
  {
    id: 'glm-5.3-flex',
    max_model_len: 1048560,
    metadata: {
      display_name: 'GLM 5.3 (flex)',
      capabilities: {
        reasoning: true,
        vision: false,
      },
      reasoning: {
        supported_efforts: ['max', 'high', 'low',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal',],
        effort_aliases: {
          xhigh: 'max',
          medium: 'high',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 1048560,
      },
    },
  },
  {
    id: 'glm-5.3-flash',
    max_model_len: 1048560,
    metadata: {
      display_name: 'GLM-5.3 Flash',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['max', 'high', 'low',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal',],
        effort_aliases: {
          xhigh: 'max',
          medium: 'high',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 1048560,
      },
    },
  },
  {
    id: 'glm-5.3-flash-flex',
    max_model_len: 1048560,
    metadata: {
      display_name: 'GLM-5.3 Flash (flex)',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['max', 'high', 'low',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal',],
        effort_aliases: {
          xhigh: 'max',
          medium: 'high',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 1048560,
      },
    },
  },
  {
    id: 'nw-small',
    max_model_len: 262128,
    metadata: {
      display_name: 'Neuralwatt Small',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['xhigh', 'medium', 'low', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          max: 'xhigh',
          high: 'xhigh',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 262128,
        max_output_tokens: 131072,
      },
    },
  },
  {
    id: 'nw-small-flex',
    max_model_len: 262128,
    metadata: {
      display_name: 'Neuralwatt Small (flex)',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['xhigh', 'medium', 'low', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          max: 'xhigh',
          high: 'xhigh',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 262128,
        max_output_tokens: 131072,
      },
    },
  },
  {
    id: 'qwen3.6-35b',
    max_model_len: 262128,
    metadata: {
      display_name: 'Qwen3.6 35B',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['high', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          max: 'high',
          xhigh: 'high',
          medium: 'high',
          low: 'high',
          minimal: 'high',
        },
      },
      limits: {
        max_context_length: 262128,
      },
    },
  },
  {
    id: 'qwen3.6-35b-fast',
    max_model_len: 262128,
    metadata: {
      display_name: 'Qwen3.6 35B Fast',
      capabilities: {
        reasoning: false,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          max: 'none',
          xhigh: 'none',
          high: 'none',
          medium: 'none',
          low: 'none',
          minimal: 'none',
        },
      },
      limits: {
        max_context_length: 262128,
      },
    },
  },
  {
    id: 'qwen3.6-35b-flex',
    max_model_len: 262128,
    metadata: {
      display_name: 'Qwen3.6 35B (flex)',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['high', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          max: 'high',
          xhigh: 'high',
          medium: 'high',
          low: 'high',
          minimal: 'high',
        },
      },
      limits: {
        max_context_length: 262128,
      },
    },
  },
  {
    id: 'deepseek-v4.1-flash',
    max_model_len: 1048560,
    metadata: {
      display_name: 'DeepSeek V4.1 Flash',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['max', 'xhigh', 'high', 'low', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          medium: 'high',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 1048560,
        max_output_tokens: 393216,
      },
    },
  },
  {
    id: 'deepseek-v4.1-flash-flex',
    max_model_len: 1048560,
    metadata: {
      display_name: 'DeepSeek V4.1 Flash (flex)',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['max', 'xhigh', 'high', 'low', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          medium: 'high',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 1048560,
        max_output_tokens: 393216,
      },
    },
  },
  {
    id: 'deepseek-v4.1-flash-speed',
    max_model_len: 1048560,
    metadata: {
      display_name: 'DeepSeek V4.1 Flash (Speed)',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['max', 'xhigh', 'high', 'low', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          medium: 'high',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 1048560,
        max_output_tokens: 393216,
      },
    },
  },
  {
    id: 'deepseek-v4-flash',
    max_model_len: 1048560,
    metadata: {
      display_name: 'DeepSeek V4 Flash',
      capabilities: {
        reasoning: true,
        vision: false,
      },
      reasoning: {
        supported_efforts: ['max', 'high', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          xhigh: 'max',
          medium: 'high',
          low: 'high',
          minimal: 'high',
        },
      },
      limits: {
        max_context_length: 1048560,
        max_output_tokens: 393216,
      },
    },
  },
  {
    id: 'deepseek-v4-flash-flex',
    max_model_len: 1048560,
    metadata: {
      display_name: 'DeepSeek V4 Flash (flex)',
      capabilities: {
        reasoning: true,
        vision: false,
      },
      reasoning: {
        supported_efforts: ['max', 'high', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          xhigh: 'max',
          medium: 'high',
          low: 'high',
          minimal: 'high',
        },
      },
      limits: {
        max_context_length: 1048560,
        max_output_tokens: 393216,
      },
    },
  },
  {
    id: 'deepseek-v4-flash-speed',
    max_model_len: 1048560,
    metadata: {
      display_name: 'DeepSeek V4 Flash (Speed)',
      capabilities: {
        reasoning: true,
        vision: false,
      },
      reasoning: {
        supported_efforts: ['max', 'high', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          xhigh: 'max',
          medium: 'high',
          low: 'high',
          minimal: 'high',
        },
      },
      limits: {
        max_context_length: 1048560,
        max_output_tokens: 393216,
      },
    },
  },
  {
    id: 'gemma-4-31b',
    max_model_len: 262128,
    metadata: {
      display_name: 'Gemma 4 31B',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['max', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          xhigh: 'max',
          high: 'max',
          medium: 'max',
          low: 'max',
          minimal: 'max',
        },
      },
      limits: {
        max_context_length: 262128,
        max_output_tokens: 16384,
      },
    },
  },
  {
    id: 'kimi-k3',
    max_model_len: 1048560,
    metadata: {
      display_name: 'Kimi K3',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['max', 'high', 'low', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          xhigh: 'max',
          medium: 'high',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 1048560,
      },
    },
  },
  {
    id: 'kimi-k3-fast',
    max_model_len: 1048560,
    metadata: {
      display_name: 'Kimi K3 Fast',
      capabilities: {
        reasoning: false,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          max: 'none',
          xhigh: 'none',
          high: 'none',
          medium: 'none',
          low: 'none',
          minimal: 'none',
        },
      },
      limits: {
        max_context_length: 1048560,
      },
    },
  },
  {
    id: 'kimi-k3-flex',
    max_model_len: 1048560,
    metadata: {
      display_name: 'Kimi K3 (flex)',
      capabilities: {
        reasoning: true,
        vision: true,
      },
      reasoning: {
        supported_efforts: ['max', 'high', 'low', 'none',],
        accepted_efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none',],
        effort_aliases: {
          xhigh: 'max',
          medium: 'high',
          minimal: 'low',
        },
      },
      limits: {
        max_context_length: 1048560,
      },
    },
  },
];

//endregion Public API
