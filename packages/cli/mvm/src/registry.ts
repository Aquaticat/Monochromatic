import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { IMAGES_DIR } from './config.ts';

//region Image spec type

/**
 * Init system used by the guest OS, determines how services are managed
 * in cloud-init runcmd directives.
 *
 * @example
 * ```ts
 * const system: InitSystem = 'systemd';
 * ```
 */
export type InitSystem = 'openrc' | 'systemd';

/**
 * Guest OS configuration needed for cloud-init provisioning.
 * Shared by both registry images and custom templates.
 *
 * @example
 * ```ts
 * const guest: GuestConfig = { defaultUser: 'ubuntu', initSystem: 'systemd', shell: '/bin/bash' };
 * ```
 */
export type GuestConfig = {
  /** Default login user created by cloud-init for this distro. */
  defaultUser: string;
  /** Init system for service management (systemd or openrc). */
  initSystem: InitSystem;
  /** Login shell path for the default user. */
  shell: string;
};

/**
 * Describes a cloud image available in the built-in registry.
 * Contains everything needed to download, cache, template-bake, and provision a VM.
 * Extends {@link GuestConfig} with download and caching metadata.
 *
 * @example
 * ```ts
 * const spec: ImageSpec = IMAGES['ubuntu'];
 * spec.defaultUser; // => 'ubuntu'
 * ```
 */
export type ImageSpec = GuestConfig & {
  /** Cached filename on disk under `~/.local/share/mvm/images/`. */
  fileName: string;
  /** Template filename derived from this image (e.g. `template-ubuntu.qcow2`). */
  templateFileName: string;
  /** Remote URL to download the cloud image from. */
  url: string;
};

//endregion Image spec type

//region Built-in image registry

/**
 * Built-in registry of supported cloud images.
 * Each entry maps a shorthand name to a full image specification.
 *
 * @example
 * ```ts
 * const fedora = IMAGES['fedora'];
 * // => { url: 'https://download.fedoraproject.org/...', defaultUser: 'fedora', ... }
 * ```
 */
export const IMAGES: Readonly<Record<string, ImageSpec>> = {
  alpine: {
    defaultUser: 'alpine',
    fileName: 'nocloud_alpine-3.23.3-x86_64-bios-cloudinit-r0.qcow2',
    initSystem: 'openrc',
    shell: '/bin/ash',
    templateFileName: 'template-alpine.qcow2',
    url: 'https://dl-cdn.alpinelinux.org/alpine/v3.23/releases/cloud/nocloud_alpine-3.23.3-x86_64-bios-cloudinit-r0.qcow2',
  },
  fedora: {
    defaultUser: 'fedora',
    fileName: 'Fedora-Cloud-Base-Generic-43-1.6.x86_64.qcow2',
    initSystem: 'systemd',
    shell: '/bin/bash',
    templateFileName: 'template-fedora.qcow2',
    url: 'https://download.fedoraproject.org/pub/fedora/linux/releases/43/Cloud/x86_64/images/Fedora-Cloud-Base-Generic-43-1.6.x86_64.qcow2',
  },
  ubuntu: {
    defaultUser: 'ubuntu',
    fileName: 'noble-server-cloudimg-amd64.img',
    initSystem: 'systemd',
    shell: '/bin/bash',
    templateFileName: 'template-ubuntu.qcow2',
    url: 'https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img',
  },
};

/** Default image shorthand when `--image` is not specified. */
export const DEFAULT_IMAGE = 'ubuntu';

/**
 * Fallback guest configuration for custom template images.
 * Uses root with systemd since the actual OS is unknown.
 *
 * @example
 * ```ts
 * createSeedIso({ name: 'vm', guest: CUSTOM_GUEST_DEFAULTS, vmDir: '...' });
 * ```
 */
export const CUSTOM_GUEST_DEFAULTS: GuestConfig = {
  defaultUser: 'root',
  initSystem: 'systemd',
  shell: '/bin/sh',
};

//endregion Built-in image registry

//region Resolution

/**
 * Resolves an image identifier to a full image spec.
 * Checks the built-in registry first. If not found, looks for a custom template
 * file named `<identifier>.qcow2` in the images directory.
 *
 * @param identifier - Registry shorthand (e.g. `ubuntu`) or custom template name
 * @returns Image spec for registry images, or `{ customTemplatePath }` for user-provided templates
 * @throws Error when identifier matches neither the registry nor a custom template file
 *
 * @example
 * ```ts
 * const result = resolveImage('ubuntu');
 * // => { kind: 'registry', spec: { url: '...', ... } }
 *
 * const custom = resolveImage('my-custom');
 * // => { kind: 'custom', customTemplatePath: '/home/user/.local/share/mvm/images/my-custom.qcow2' }
 * ```
 */
export function resolveImage(identifier: string): ResolvedImage {
  const spec = IMAGES[identifier];
  if (spec !== undefined) {
    return { kind: 'registry', spec };
  }

  const customPath = join(IMAGES_DIR, `${identifier}.qcow2`);
  if (existsSync(customPath)) {
    return { customTemplatePath: customPath, kind: 'custom' };
  }

  const available = Object.keys(IMAGES).join(', ');
  throw new Error(
    `unknown image "${identifier}". Built-in images: ${available}. `
    + `For custom images, place a qcow2 template at ${customPath}`,
  );
}

/**
 * Discriminated union returned by {@link resolveImage}.
 * Registry images go through the download-and-template-bake pipeline.
 * Custom images are used directly as backing templates.
 *
 * @example
 * ```ts
 * const resolved = resolveImage('ubuntu');
 * if (resolved.kind === 'registry') {
 *   resolved.spec.url; // download URL
 * }
 * ```
 */
export type ResolvedImage =
  | { customTemplatePath: string; kind: 'custom' }
  | { kind: 'registry'; spec: ImageSpec };

//endregion Resolution
