# A USB drive missing from Dolphin can mean no USB enumeration at all, not a mount failure

## Symptom

On Bazzite 44 (Kinoite) with KDE Plasma,
a USB flash drive plugged into a front-panel case port does not appear in Dolphin.

The tempting reading is that Dolphin,
`udisks2`,
or automounting is at fault.
On the observed incident none of those were involved:
the kernel never enumerated the device,
so every layer above it was correctly reporting nothing.

## Distinguishing enumeration failure from mount failure

The decisive evidence is kernel log silence,
not the absence of a block device.

```bash
# Any kernel message at all since the plug event?
journalctl --dmesg --since "30 min ago" --no-pager | wc --lines

# Most recent kernel message of any kind
journalctl --dmesg --no-pager --output short-iso | tail --lines 1
```

On the observed incident the last kernel message predated the reported plug event by 40 minutes,
and the last USB enumeration of any device predated it by more than 8 hours.
A device that enumerates and then fails to mount always leaves `usb`,
`usb-storage`,
and `scsi` lines behind.
Silence means the plug event never reached the kernel.

`usb_storage` and `uas` being absent from `lsmod` is a consequence of this,
not a cause.
Both load on demand from the modalias of an attached mass storage device.
Reporting the missing module as the fault sends the user to `modprobe`,
which does nothing.

## Downstream checks agree because they share one upstream fact

These four commands all report the drive missing:

```bash
lsblk --output NAME,SIZE,TYPE,FSTYPE,LABEL,MOUNTPOINT,TRAN,HOTPLUG
lsusb
udisksctl status
journalctl --dmesg --boot 0
```

Their agreement is one measurement,
not four,
because each reads a view built on USB enumeration.
Treat the set as a single data point and obtain an independent one before concluding.

## Obtaining an independent probe

Start a live capture,
then have the user unplug and replug while it runs:

```bash
udevadm monitor --udev --kernel --subsystem-match=usb --subsystem-match=block
```

A working insertion produces paired `KERNEL` and `UDEV` `add` events for the `usb` device,
followed by `add` events for the `block` device and each partition.
A physically failing insertion usually still emits something,
such as a repeated `device descriptor read/64, error -71`.
Total silence during a witnessed replug narrows the cause to the connection itself.

## Front-panel ports fail more often than rear ports

On the observed incident the replug used the same front-panel port and enumerated cleanly at SuperSpeed
with no error lines:

```text
usb 2-4: new SuperSpeed USB device number 2 using xhci_hcd
usb 2-4: New USB device found, idVendor=13fe, idProduct=6300, bcdDevice= 1.10
usb 2-4: Product: Patriot Memory
usb-storage 2-4:1.0: USB Mass Storage device detected
sd 6:0:0:0: [sdb] Attached SCSI removable disk
```

The port and cable were therefore functional,
and the first insertion simply did not make contact.
Front-panel ports reach the board through an internal header cable,
which adds seating and contact failure modes that rear ports connected directly to a root hub do not have.
Testing a rear port isolates the header cable from the drive.

Autosuspend was ruled out on this host and was not the cause.
Every root hub carried `power/control = auto` with `autosuspend_delay_ms = 0`,
and the one external hub present carried `power/control = on`.

## An isohybrid live image looks broken but is not

The drive on the observed incident was a Titanoboa live USB.
Its layout explains several alarming but correct observations:

```text
sdb    28.9G disk iso9660 titanoboa_boot
├─sdb1  7.5G part iso9660 titanoboa_boot
├─sdb2   25M part vfat    EFI
└─sdb3  300K part
```

- The mounted filesystem is read-only because `iso9660` is read-only.
  `udisksctl info` reports `ReadOnly: false` for the block device,
  which describes the medium,
  not the filesystem.
  The actual mount carries `ro`.
- Only 7.5G of a 28.9G stick is addressable.
  Writing an image with `dd` leaves the remainder unallocated.
  Recovering it requires repartitioning,
  which destroys the bootable layout.
- The EFI system partition is hidden from Dolphin on purpose.
  `udisksctl info --block-device /dev/sdb2` reports `HintIgnore: true`.
  Only `sdb1` carries `HintAuto: true` with `HintIgnore: false`,
  so exactly one entry is expected in the Places panel.
- `fdisk` prints `GPT PMBR size mismatch (15819131 != 60604415) will be corrected by write`.
  This is the expected artifact of writing a 7.5G image onto a larger stick.
  Letting a partition editor correct it writes to the hybrid layout,
  so decline the correction while the stick is still wanted as a bootable device.

## Verifying at the user boundary

Enumeration alone does not prove the data path works.
Mount the volume the way Dolphin would,
through `udisks` and without `sudo`:

```bash
udisksctl mount --block-device /dev/sdb1
findmnt --source /dev/sdb1
```

A successful mount lands under `/run/media/<user>/<label>`,
which is the path Dolphin surfaces in its Places panel.
