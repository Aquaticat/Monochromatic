import { createIso } from './iso9660.ts';
import { l, tagged } from './log.ts';

//region Autounattend XML generation

/**
 * Windows component XML attribute boilerplate shared by all unattend components.
 * Contains the processor architecture, public key token, language, version scope,
 * and XML namespace declarations required by Windows Setup.
 */
const COMPONENT_ATTRS = 'processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';

/**
 * Possible drive letters where the virtio-win ISO may be mounted during WinPE.
 * Windows PE assigns letters dynamically based on device enumeration order.
 * Including multiple candidates ensures the drivers are found regardless of
 * how many CDROMs are attached or in what order.
 */
const VIRTIO_DRIVE_CANDIDATES = ['D', 'E', 'F', 'G'];



/**
 * Windows Server 2025 driver subdirectory within the virtio-win ISO.
 * Server 2025 shares drivers with Windows 11 (`w11` directory).
 */
const VIRTIO_DRIVER_OS_DIR = 'w11';

/**
 * Generates the PnpCustomizationsWinPE component XML for loading VirtIO drivers
 * during Windows PE. Searches multiple drive letters for the viostor (storage)
 * and NetKVM (network) drivers so the virtio disk is visible during partitioning.
 *
 * @returns XML string for the PnpCustomizationsWinPE component
 *
 * @example
 * ```ts
 * pnpDriverPaths(); // => '<component name="Microsoft-Windows-PnpCustomizationsWinPE" ...>...'
 * ```
 */
function pnpDriverPaths(): string {
  const driverDirs = ['viostor', 'NetKVM'];
  let keyValue = 1;
  const paths = driverDirs.flatMap((driver) =>
    VIRTIO_DRIVE_CANDIDATES.map((letter) => {
      const entry = `      <PathAndCredentials wcm:action="add" wcm:keyValue="${String(keyValue)}">
        <Path>${letter}:\\${driver}\\${VIRTIO_DRIVER_OS_DIR}\\amd64</Path>
      </PathAndCredentials>`;
      keyValue++;
      return entry;
    }),
  );

  return `    <component name="Microsoft-Windows-PnpCustomizationsWinPE" ${COMPONENT_ATTRS}>
      <DriverPaths>
${paths.join('\n')}
      </DriverPaths>
    </component>`;
}

/**
 * VirtIO driver subdirectories to install from the virtio-win ISO.
 * Only the drivers needed for VM operation: storage (disk), network,
 * serial (guest agent communication), and QEMU firmware config.
 */
const VIRTIO_DRIVER_DIRS = ['viostor', 'NetKVM', 'vioserial', 'qemufwcfg'];

/**
 * Generates a PowerShell command that:
 * 1. Finds the virtio-win CDROM among candidate drive letters
 * 2. Imports the Red Hat signing certificate into Trusted Publishers
 *    to suppress driver signing prompts
 * 3. Installs VirtIO drivers for the correct OS version via `pnputil`
 * 4. Installs the QEMU guest agent from the standalone MSI
 *
 * Only installs drivers for the `w11` (Server 2025) platform to avoid
 * hash failures from older driver versions.
 *
 * @returns PowerShell command string for VirtIO driver and guest agent installation
 *
 * @example
 * ```ts
 * virtioInstallCommand();
 * // => "powershell -NoProfile -Command ..."
 * ```
 */
function virtioInstallCommand(): string {
  const driveList = VIRTIO_DRIVE_CANDIDATES.map((d) => `'${d}:\\'`).join(',');
  /** pnputil calls for each driver directory, targeting the correct OS version. */
  const pnputilCalls = VIRTIO_DRIVER_DIRS.map((dir) =>
    `pnputil /add-driver (Join-Path $root '${dir}\\${VIRTIO_DRIVER_OS_DIR}\\amd64\\*.inf') /install`,
  ).join('; ');
  return `powershell -NoProfile -Command "${ // find the virtio-win CDROM by looking for the viostor directory
    ''
  }$vd = Get-ChildItem -Path ${driveList} -Directory -Filter 'viostor' -ErrorAction SilentlyContinue | Select-Object -First 1; ${ // proceed only if virtio-win ISO is found
    ''
  }if ($vd) { $root = $vd.Parent.FullName; ${ // import Red Hat certificate to suppress driver signing dialogs
    ''
  }Get-ChildItem (Join-Path $root 'cert\\*.cer') -Recurse | ForEach-Object { certutil -addstore TrustedPublisher $_.FullName }; ${ // install VirtIO drivers for Server 2025 (w11) platform only
    ''
  }${pnputilCalls}; ${ // install standalone guest agent MSI from the guest-agent subfolder
    ''
  }$ga = Join-Path $root 'guest-agent\\qemu-ga-x86_64.msi'; ${ // fall back to all-in-one MSI if standalone is absent
    ''
  }if (-not (Test-Path $ga)) { $ga = Join-Path $root 'virtio-win-gt-x64.msi' }; ${ // run silent install and wait for completion
    ''
  }Start-Process msiexec -ArgumentList '/i',$ga,'/qn','/norestart','/log','C:\\virtio-install.log' -Wait }"`;
}

/**
 * Generates a complete Windows Autounattend.xml answer file for unattended
 * installation of Windows Server from an evaluation ISO on KVM with VirtIO.
 *
 * The answer file configures:
 * - VirtIO storage and network driver loading during WinPE
 * - MBR disk partitioning (system reserved + OS partition) for BIOS boot
 * - Unattended OS image selection by WIM index
 * - Locale and timezone settings
 * - Administrator account with auto-logon
 * - QEMU guest agent installation via FirstLogonCommands
 * - OOBE bypass for fully automated setup
 *
 * @param options - WIM image index for edition selection and hostname for the VM
 * @returns Complete Autounattend.xml content string
 *
 * @example
 * ```ts
 * const xml = generateAutounattend({ imageIndex: 1, hostname: 'template-setup' });
 * ```
 */
export function generateAutounattend({ hostname, imageIndex }: {
  hostname: string;
  imageIndex: number;
}): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<unattend xmlns="urn:schemas-microsoft-com:unattend">
  <settings pass="windowsPE">
    <component name="Microsoft-Windows-International-Core-WinPE" ${COMPONENT_ATTRS}>
      <SetupUILanguage>
        <UILanguage>en-US</UILanguage>
      </SetupUILanguage>
      <InputLocale>en-US</InputLocale>
      <SystemLocale>en-US</SystemLocale>
      <UILanguage>en-US</UILanguage>
      <UserLocale>en-US</UserLocale>
    </component>
    <component name="Microsoft-Windows-Setup" ${COMPONENT_ATTRS}>
      <DiskConfiguration>
        <WillShowUI>OnError</WillShowUI>
        <Disk wcm:action="add">
          <DiskID>0</DiskID>
          <WillWipeDisk>true</WillWipeDisk>
          <CreatePartitions>
            <CreatePartition wcm:action="add">
              <Order>1</Order>
              <Size>100</Size>
              <Type>Primary</Type>
            </CreatePartition>
            <CreatePartition wcm:action="add">
              <Order>2</Order>
              <Extend>true</Extend>
              <Type>Primary</Type>
            </CreatePartition>
          </CreatePartitions>
          <ModifyPartitions>
            <ModifyPartition wcm:action="add">
              <Order>1</Order>
              <PartitionID>1</PartitionID>
              <Active>true</Active>
              <Format>NTFS</Format>
              <Label>System</Label>
            </ModifyPartition>
            <ModifyPartition wcm:action="add">
              <Order>2</Order>
              <PartitionID>2</PartitionID>
              <Format>NTFS</Format>
              <Label>Windows</Label>
              <Letter>C</Letter>
            </ModifyPartition>
          </ModifyPartitions>
        </Disk>
      </DiskConfiguration>
      <ImageInstall>
        <OSImage>
          <InstallFrom>
            <MetaData wcm:action="add">
              <Key>/IMAGE/INDEX</Key>
              <Value>${String(imageIndex)}</Value>
            </MetaData>
          </InstallFrom>
          <InstallTo>
            <DiskID>0</DiskID>
            <PartitionID>2</PartitionID>
          </InstallTo>
        </OSImage>
      </ImageInstall>
      <UserData>
        <AcceptEula>true</AcceptEula>
      </UserData>
    </component>
${pnpDriverPaths()}
  </settings>
  <settings pass="specialize">
    <component name="Microsoft-Windows-Shell-Setup" ${COMPONENT_ATTRS}>
      <ComputerName>${hostname}</ComputerName>
      <TimeZone>UTC</TimeZone>
    </component>
    <component name="Microsoft-Windows-TerminalServices-LocalSessionManager" ${COMPONENT_ATTRS}>
      <fDenyTSConnections>false</fDenyTSConnections>
    </component>
    <component name="Networking-MPSSVC-Svc" ${COMPONENT_ATTRS}>
      <FirewallGroups>
        <FirewallGroup wcm:action="add" wcm:keyValue="RemoteDesktop">
          <Active>true</Active>
          <Group>Remote Desktop</Group>
          <Profile>all</Profile>
        </FirewallGroup>
      </FirewallGroups>
    </component>
  </settings>
  <settings pass="oobeSystem">
    <component name="Microsoft-Windows-Shell-Setup" ${COMPONENT_ATTRS}>
      <OOBE>
        <HideEULAPage>true</HideEULAPage>
        <HideLocalAccountScreen>true</HideLocalAccountScreen>
        <HideOnlineAccountScreens>true</HideOnlineAccountScreens>
        <HideWirelessSetupInOOBE>true</HideWirelessSetupInOOBE>
        <ProtectYourPC>3</ProtectYourPC>
      </OOBE>
      <UserAccounts>
        <AdministratorPassword>
          <Value>mvm</Value>
          <PlainText>true</PlainText>
        </AdministratorPassword>
      </UserAccounts>
      <AutoLogon>
        <Enabled>true</Enabled>
        <Username>Administrator</Username>
        <Password>
          <Value>mvm</Value>
          <PlainText>true</PlainText>
        </Password>
        <LogonCount>5</LogonCount>
      </AutoLogon>
      <FirstLogonCommands>
        <SynchronousCommand wcm:action="add">
          <Order>1</Order>
          <CommandLine>${virtioInstallCommand()}</CommandLine>
          <Description>Install VirtIO drivers and QEMU guest agent via pnputil and MSI</Description>
        </SynchronousCommand>
        <SynchronousCommand wcm:action="add">
          <Order>2</Order>
          <CommandLine>powershell -NoProfile -Command "Set-Service -Name QEMU-GA -StartupType Automatic -ErrorAction SilentlyContinue; Start-Service QEMU-GA -ErrorAction SilentlyContinue"</CommandLine>
          <Description>Enable and start QEMU guest agent service</Description>
        </SynchronousCommand>
        <SynchronousCommand wcm:action="add">
          <Order>3</Order>
          <CommandLine>powershell -NoProfile -Command "Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False"</CommandLine>
          <Description>Disable Windows Firewall for VM networking</Description>
        </SynchronousCommand>
      </FirstLogonCommands>
    </component>
  </settings>
</unattend>`;
}

//endregion Autounattend XML generation

//region Autounattend ISO generation

/**
 * Creates an ISO9660 image containing the Autounattend.xml answer file.
 * Windows PE automatically searches removable media (including CDROMs) for
 * this file during setup. The ISO is attached as a secondary CDROM during
 * Windows template creation.
 *
 * @param options - WIM image index and hostname passed to {@link generateAutounattend}
 * @returns ISO9660 image bytes ready to write to disk
 *
 * @example
 * ```ts
 * const iso = createAutounattendIso({ imageIndex: 1, hostname: 'template-setup' });
 * await Bun.write('/path/to/autounattend.iso', iso);
 * ```
 */
export function createAutounattendIso({ hostname, imageIndex }: {
  hostname: string;
  imageIndex: number;
}): Uint8Array {
  const rl = tagged({ tag: createAutounattendIso.name, l });
  const xml = generateAutounattend({ hostname, imageIndex });
  const encoder = new TextEncoder();

  const iso = createIso({
    files: [
      { data: encoder.encode(xml), name: 'Autounattend.xml' },
    ],
    volumeId: 'OEMDRV',
  });

  rl.info('created Autounattend ISO');
  return iso;
}

//endregion Autounattend ISO generation
