import "@astrojs/internal-helpers/path";
import { A as AstroError, c as ExpectedImageOptions, E as ExpectedImage, F as FailedToFetchRemoteImageDimensions, d as InvalidImageService, e as createAstro, f as createComponent, g as ImageMissingAlt, r as renderTemplate, m as maybeRenderHead, h as addAttribute, s as spreadAttributes, _ as __astro_tag_component__, i as Fragment, j as createVNode, k as renderSlot } from "./astro_B03jorkr.mjs";
import "html-escaper";
import "clsx";
import "kleur/colors";
import rss from "@astrojs/rss";
import { i as isRemoteImage, a as isESMImportedImage, b as isLocalService, D as DEFAULT_HASH_PROPS } from "./astro/assets-service_XQB9jBkQ.mjs";
const decoder = new TextDecoder();
const toUTF8String = (input, start = 0, end = input.length) => decoder.decode(input.slice(start, end));
const toHexString = (input, start = 0, end = input.length) => input.slice(start, end).reduce((memo, i) => memo + ("0" + i.toString(16)).slice(-2), "");
const readInt16LE = (input, offset = 0) => {
  const val = input[offset] + input[offset + 1] * 2 ** 8;
  return val | (val & 2 ** 15) * 131070;
};
const readUInt16BE = (input, offset = 0) => input[offset] * 2 ** 8 + input[offset + 1];
const readUInt16LE = (input, offset = 0) => input[offset] + input[offset + 1] * 2 ** 8;
const readUInt24LE = (input, offset = 0) => input[offset] + input[offset + 1] * 2 ** 8 + input[offset + 2] * 2 ** 16;
const readInt32LE = (input, offset = 0) => input[offset] + input[offset + 1] * 2 ** 8 + input[offset + 2] * 2 ** 16 + (input[offset + 3] << 24);
const readUInt32BE = (input, offset = 0) => input[offset] * 2 ** 24 + input[offset + 1] * 2 ** 16 + input[offset + 2] * 2 ** 8 + input[offset + 3];
const readUInt32LE = (input, offset = 0) => input[offset] + input[offset + 1] * 2 ** 8 + input[offset + 2] * 2 ** 16 + input[offset + 3] * 2 ** 24;
const methods = {
  readUInt16BE,
  readUInt16LE,
  readUInt32BE,
  readUInt32LE
};
function readUInt(input, bits, offset, isBigEndian) {
  offset = offset || 0;
  const endian = isBigEndian ? "BE" : "LE";
  const methodName = "readUInt" + bits + endian;
  return methods[methodName](input, offset);
}
function readBox(buffer, offset) {
  if (buffer.length - offset < 4)
    return;
  const boxSize = readUInt32BE(buffer, offset);
  if (buffer.length - offset < boxSize)
    return;
  return {
    name: toUTF8String(buffer, 4 + offset, 8 + offset),
    offset,
    size: boxSize
  };
}
function findBox(buffer, boxName, offset) {
  while (offset < buffer.length) {
    const box = readBox(buffer, offset);
    if (!box)
      break;
    if (box.name === boxName)
      return box;
    offset += box.size;
  }
}
const BMP = {
  validate: (input) => toUTF8String(input, 0, 2) === "BM",
  calculate: (input) => ({
    height: Math.abs(readInt32LE(input, 22)),
    width: readUInt32LE(input, 18)
  })
};
const TYPE_ICON = 1;
const SIZE_HEADER$1 = 2 + 2 + 2;
const SIZE_IMAGE_ENTRY = 1 + 1 + 1 + 1 + 2 + 2 + 4 + 4;
function getSizeFromOffset(input, offset) {
  const value = input[offset];
  return value === 0 ? 256 : value;
}
function getImageSize$1(input, imageIndex) {
  const offset = SIZE_HEADER$1 + imageIndex * SIZE_IMAGE_ENTRY;
  return {
    height: getSizeFromOffset(input, offset + 1),
    width: getSizeFromOffset(input, offset)
  };
}
const ICO = {
  validate(input) {
    const reserved = readUInt16LE(input, 0);
    const imageCount = readUInt16LE(input, 4);
    if (reserved !== 0 || imageCount === 0)
      return false;
    const imageType = readUInt16LE(input, 2);
    return imageType === TYPE_ICON;
  },
  calculate(input) {
    const nbImages = readUInt16LE(input, 4);
    const imageSize = getImageSize$1(input, 0);
    if (nbImages === 1)
      return imageSize;
    const imgs = [imageSize];
    for (let imageIndex = 1; imageIndex < nbImages; imageIndex += 1) {
      imgs.push(getImageSize$1(input, imageIndex));
    }
    return {
      height: imageSize.height,
      images: imgs,
      width: imageSize.width
    };
  }
};
const TYPE_CURSOR = 2;
const CUR = {
  validate(input) {
    const reserved = readUInt16LE(input, 0);
    const imageCount = readUInt16LE(input, 4);
    if (reserved !== 0 || imageCount === 0)
      return false;
    const imageType = readUInt16LE(input, 2);
    return imageType === TYPE_CURSOR;
  },
  calculate: (input) => ICO.calculate(input)
};
const DDS = {
  validate: (input) => readUInt32LE(input, 0) === 542327876,
  calculate: (input) => ({
    height: readUInt32LE(input, 12),
    width: readUInt32LE(input, 16)
  })
};
const gifRegexp = /^GIF8[79]a/;
const GIF = {
  validate: (input) => gifRegexp.test(toUTF8String(input, 0, 6)),
  calculate: (input) => ({
    height: readUInt16LE(input, 8),
    width: readUInt16LE(input, 6)
  })
};
const brandMap = {
  avif: "avif",
  mif1: "heif",
  msf1: "heif",
  // hief-sequence
  heic: "heic",
  heix: "heic",
  hevc: "heic",
  // heic-sequence
  hevx: "heic"
  // heic-sequence
};
function detectBrands(buffer, start, end) {
  let brandsDetected = {};
  for (let i = start; i <= end; i += 4) {
    const brand = toUTF8String(buffer, i, i + 4);
    if (brand in brandMap) {
      brandsDetected[brand] = 1;
    }
  }
  if ("avif" in brandsDetected) {
    return "avif";
  } else if ("heic" in brandsDetected || "heix" in brandsDetected || "hevc" in brandsDetected || "hevx" in brandsDetected) {
    return "heic";
  } else if ("mif1" in brandsDetected || "msf1" in brandsDetected) {
    return "heif";
  }
}
const HEIF = {
  validate(buffer) {
    const ftype = toUTF8String(buffer, 4, 8);
    const brand = toUTF8String(buffer, 8, 12);
    return "ftyp" === ftype && brand in brandMap;
  },
  calculate(buffer) {
    const metaBox = findBox(buffer, "meta", 0);
    const iprpBox = metaBox && findBox(buffer, "iprp", metaBox.offset + 12);
    const ipcoBox = iprpBox && findBox(buffer, "ipco", iprpBox.offset + 8);
    const ispeBox = ipcoBox && findBox(buffer, "ispe", ipcoBox.offset + 8);
    if (ispeBox) {
      return {
        height: readUInt32BE(buffer, ispeBox.offset + 16),
        width: readUInt32BE(buffer, ispeBox.offset + 12),
        type: detectBrands(buffer, 8, metaBox.offset)
      };
    }
    throw new TypeError("Invalid HEIF, no size found");
  }
};
const SIZE_HEADER = 4 + 4;
const FILE_LENGTH_OFFSET = 4;
const ENTRY_LENGTH_OFFSET = 4;
const ICON_TYPE_SIZE = {
  ICON: 32,
  "ICN#": 32,
  // m => 16 x 16
  "icm#": 16,
  icm4: 16,
  icm8: 16,
  // s => 16 x 16
  "ics#": 16,
  ics4: 16,
  ics8: 16,
  is32: 16,
  s8mk: 16,
  icp4: 16,
  // l => 32 x 32
  icl4: 32,
  icl8: 32,
  il32: 32,
  l8mk: 32,
  icp5: 32,
  ic11: 32,
  // h => 48 x 48
  ich4: 48,
  ich8: 48,
  ih32: 48,
  h8mk: 48,
  // . => 64 x 64
  icp6: 64,
  ic12: 32,
  // t => 128 x 128
  it32: 128,
  t8mk: 128,
  ic07: 128,
  // . => 256 x 256
  ic08: 256,
  ic13: 256,
  // . => 512 x 512
  ic09: 512,
  ic14: 512,
  // . => 1024 x 1024
  ic10: 1024
};
function readImageHeader(input, imageOffset) {
  const imageLengthOffset = imageOffset + ENTRY_LENGTH_OFFSET;
  return [
    toUTF8String(input, imageOffset, imageLengthOffset),
    readUInt32BE(input, imageLengthOffset)
  ];
}
function getImageSize(type) {
  const size = ICON_TYPE_SIZE[type];
  return { width: size, height: size, type };
}
const ICNS = {
  validate: (input) => toUTF8String(input, 0, 4) === "icns",
  calculate(input) {
    const inputLength = input.length;
    const fileLength = readUInt32BE(input, FILE_LENGTH_OFFSET);
    let imageOffset = SIZE_HEADER;
    let imageHeader = readImageHeader(input, imageOffset);
    let imageSize = getImageSize(imageHeader[0]);
    imageOffset += imageHeader[1];
    if (imageOffset === fileLength)
      return imageSize;
    const result = {
      height: imageSize.height,
      images: [imageSize],
      width: imageSize.width
    };
    while (imageOffset < fileLength && imageOffset < inputLength) {
      imageHeader = readImageHeader(input, imageOffset);
      imageSize = getImageSize(imageHeader[0]);
      imageOffset += imageHeader[1];
      result.images.push(imageSize);
    }
    return result;
  }
};
const J2C = {
  // TODO: this doesn't seem right. SIZ marker doesn't have to be right after the SOC
  validate: (input) => toHexString(input, 0, 4) === "ff4fff51",
  calculate: (input) => ({
    height: readUInt32BE(input, 12),
    width: readUInt32BE(input, 8)
  })
};
const JP2 = {
  validate(input) {
    if (readUInt32BE(input, 4) !== 1783636e3 || readUInt32BE(input, 0) < 1)
      return false;
    const ftypBox = findBox(input, "ftyp", 0);
    if (!ftypBox)
      return false;
    return readUInt32BE(input, ftypBox.offset + 4) === 1718909296;
  },
  calculate(input) {
    const jp2hBox = findBox(input, "jp2h", 0);
    const ihdrBox = jp2hBox && findBox(input, "ihdr", jp2hBox.offset + 8);
    if (ihdrBox) {
      return {
        height: readUInt32BE(input, ihdrBox.offset + 8),
        width: readUInt32BE(input, ihdrBox.offset + 12)
      };
    }
    throw new TypeError("Unsupported JPEG 2000 format");
  }
};
const EXIF_MARKER = "45786966";
const APP1_DATA_SIZE_BYTES = 2;
const EXIF_HEADER_BYTES = 6;
const TIFF_BYTE_ALIGN_BYTES = 2;
const BIG_ENDIAN_BYTE_ALIGN = "4d4d";
const LITTLE_ENDIAN_BYTE_ALIGN = "4949";
const IDF_ENTRY_BYTES = 12;
const NUM_DIRECTORY_ENTRIES_BYTES = 2;
function isEXIF(input) {
  return toHexString(input, 2, 6) === EXIF_MARKER;
}
function extractSize(input, index2) {
  return {
    height: readUInt16BE(input, index2),
    width: readUInt16BE(input, index2 + 2)
  };
}
function extractOrientation(exifBlock, isBigEndian) {
  const idfOffset = 8;
  const offset = EXIF_HEADER_BYTES + idfOffset;
  const idfDirectoryEntries = readUInt(exifBlock, 16, offset, isBigEndian);
  for (let directoryEntryNumber = 0; directoryEntryNumber < idfDirectoryEntries; directoryEntryNumber++) {
    const start = offset + NUM_DIRECTORY_ENTRIES_BYTES + directoryEntryNumber * IDF_ENTRY_BYTES;
    const end = start + IDF_ENTRY_BYTES;
    if (start > exifBlock.length) {
      return;
    }
    const block = exifBlock.slice(start, end);
    const tagNumber = readUInt(block, 16, 0, isBigEndian);
    if (tagNumber === 274) {
      const dataFormat = readUInt(block, 16, 2, isBigEndian);
      if (dataFormat !== 3) {
        return;
      }
      const numberOfComponents = readUInt(block, 32, 4, isBigEndian);
      if (numberOfComponents !== 1) {
        return;
      }
      return readUInt(block, 16, 8, isBigEndian);
    }
  }
}
function validateExifBlock(input, index2) {
  const exifBlock = input.slice(APP1_DATA_SIZE_BYTES, index2);
  const byteAlign = toHexString(
    exifBlock,
    EXIF_HEADER_BYTES,
    EXIF_HEADER_BYTES + TIFF_BYTE_ALIGN_BYTES
  );
  const isBigEndian = byteAlign === BIG_ENDIAN_BYTE_ALIGN;
  const isLittleEndian = byteAlign === LITTLE_ENDIAN_BYTE_ALIGN;
  if (isBigEndian || isLittleEndian) {
    return extractOrientation(exifBlock, isBigEndian);
  }
}
function validateInput(input, index2) {
  if (index2 > input.length) {
    throw new TypeError("Corrupt JPG, exceeded buffer limits");
  }
}
const JPG = {
  validate: (input) => toHexString(input, 0, 2) === "ffd8",
  calculate(input) {
    input = input.slice(4);
    let orientation;
    let next;
    while (input.length) {
      const i = readUInt16BE(input, 0);
      if (input[i] !== 255) {
        input = input.slice(1);
        continue;
      }
      if (isEXIF(input)) {
        orientation = validateExifBlock(input, i);
      }
      validateInput(input, i);
      next = input[i + 1];
      if (next === 192 || next === 193 || next === 194) {
        const size = extractSize(input, i + 5);
        if (!orientation) {
          return size;
        }
        return {
          height: size.height,
          orientation,
          width: size.width
        };
      }
      input = input.slice(i + 2);
    }
    throw new TypeError("Invalid JPG, no size found");
  }
};
const KTX = {
  validate: (input) => {
    const signature = toUTF8String(input, 1, 7);
    return ["KTX 11", "KTX 20"].includes(signature);
  },
  calculate: (input) => {
    const type = input[5] === 49 ? "ktx" : "ktx2";
    const offset = type === "ktx" ? 36 : 20;
    return {
      height: readUInt32LE(input, offset + 4),
      width: readUInt32LE(input, offset),
      type
    };
  }
};
const pngSignature = "PNG\r\n\n";
const pngImageHeaderChunkName = "IHDR";
const pngFriedChunkName = "CgBI";
const PNG = {
  validate(input) {
    if (pngSignature === toUTF8String(input, 1, 8)) {
      let chunkName = toUTF8String(input, 12, 16);
      if (chunkName === pngFriedChunkName) {
        chunkName = toUTF8String(input, 28, 32);
      }
      if (chunkName !== pngImageHeaderChunkName) {
        throw new TypeError("Invalid PNG");
      }
      return true;
    }
    return false;
  },
  calculate(input) {
    if (toUTF8String(input, 12, 16) === pngFriedChunkName) {
      return {
        height: readUInt32BE(input, 36),
        width: readUInt32BE(input, 32)
      };
    }
    return {
      height: readUInt32BE(input, 20),
      width: readUInt32BE(input, 16)
    };
  }
};
const PNMTypes = {
  P1: "pbm/ascii",
  P2: "pgm/ascii",
  P3: "ppm/ascii",
  P4: "pbm",
  P5: "pgm",
  P6: "ppm",
  P7: "pam",
  PF: "pfm"
};
const handlers = {
  default: (lines) => {
    let dimensions = [];
    while (lines.length > 0) {
      const line = lines.shift();
      if (line[0] === "#") {
        continue;
      }
      dimensions = line.split(" ");
      break;
    }
    if (dimensions.length === 2) {
      return {
        height: parseInt(dimensions[1], 10),
        width: parseInt(dimensions[0], 10)
      };
    } else {
      throw new TypeError("Invalid PNM");
    }
  },
  pam: (lines) => {
    const size = {};
    while (lines.length > 0) {
      const line = lines.shift();
      if (line.length > 16 || line.charCodeAt(0) > 128) {
        continue;
      }
      const [key, value] = line.split(" ");
      if (key && value) {
        size[key.toLowerCase()] = parseInt(value, 10);
      }
      if (size.height && size.width) {
        break;
      }
    }
    if (size.height && size.width) {
      return {
        height: size.height,
        width: size.width
      };
    } else {
      throw new TypeError("Invalid PAM");
    }
  }
};
const PNM = {
  validate: (input) => toUTF8String(input, 0, 2) in PNMTypes,
  calculate(input) {
    const signature = toUTF8String(input, 0, 2);
    const type = PNMTypes[signature];
    const lines = toUTF8String(input, 3).split(/[\r\n]+/);
    const handler = handlers[type] || handlers.default;
    return handler(lines);
  }
};
const PSD = {
  validate: (input) => toUTF8String(input, 0, 4) === "8BPS",
  calculate: (input) => ({
    height: readUInt32BE(input, 14),
    width: readUInt32BE(input, 18)
  })
};
const svgReg = /<svg\s([^>"']|"[^"]*"|'[^']*')*>/;
const extractorRegExps = {
  height: /\sheight=(['"])([^%]+?)\1/,
  root: svgReg,
  viewbox: /\sviewBox=(['"])(.+?)\1/i,
  width: /\swidth=(['"])([^%]+?)\1/
};
const INCH_CM = 2.54;
const units = {
  in: 96,
  cm: 96 / INCH_CM,
  em: 16,
  ex: 8,
  m: 96 / INCH_CM * 100,
  mm: 96 / INCH_CM / 10,
  pc: 96 / 72 / 12,
  pt: 96 / 72,
  px: 1
};
const unitsReg = new RegExp(
  // eslint-disable-next-line regexp/prefer-d
  `^([0-9.]+(?:e\\d+)?)(${Object.keys(units).join("|")})?$`
);
function parseLength(len) {
  const m = unitsReg.exec(len);
  if (!m) {
    return void 0;
  }
  return Math.round(Number(m[1]) * (units[m[2]] || 1));
}
function parseViewbox(viewbox) {
  const bounds = viewbox.split(" ");
  return {
    height: parseLength(bounds[3]),
    width: parseLength(bounds[2])
  };
}
function parseAttributes(root) {
  const width = root.match(extractorRegExps.width);
  const height = root.match(extractorRegExps.height);
  const viewbox = root.match(extractorRegExps.viewbox);
  return {
    height: height && parseLength(height[2]),
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    viewbox: viewbox && parseViewbox(viewbox[2]),
    width: width && parseLength(width[2])
  };
}
function calculateByDimensions(attrs) {
  return {
    height: attrs.height,
    width: attrs.width
  };
}
function calculateByViewbox(attrs, viewbox) {
  const ratio = viewbox.width / viewbox.height;
  if (attrs.width) {
    return {
      height: Math.floor(attrs.width / ratio),
      width: attrs.width
    };
  }
  if (attrs.height) {
    return {
      height: attrs.height,
      width: Math.floor(attrs.height * ratio)
    };
  }
  return {
    height: viewbox.height,
    width: viewbox.width
  };
}
const SVG = {
  // Scan only the first kilo-byte to speed up the check on larger files
  validate: (input) => svgReg.test(toUTF8String(input, 0, 1e3)),
  calculate(input) {
    const root = toUTF8String(input).match(extractorRegExps.root);
    if (root) {
      const attrs = parseAttributes(root[0]);
      if (attrs.width && attrs.height) {
        return calculateByDimensions(attrs);
      }
      if (attrs.viewbox) {
        return calculateByViewbox(attrs, attrs.viewbox);
      }
    }
    throw new TypeError("Invalid SVG");
  }
};
const TGA = {
  validate(input) {
    return readUInt16LE(input, 0) === 0 && readUInt16LE(input, 4) === 0;
  },
  calculate(input) {
    return {
      height: readUInt16LE(input, 14),
      width: readUInt16LE(input, 12)
    };
  }
};
function readIFD(input, isBigEndian) {
  const ifdOffset = readUInt(input, 32, 4, isBigEndian);
  return input.slice(ifdOffset + 2);
}
function readValue(input, isBigEndian) {
  const low = readUInt(input, 16, 8, isBigEndian);
  const high = readUInt(input, 16, 10, isBigEndian);
  return (high << 16) + low;
}
function nextTag(input) {
  if (input.length > 24) {
    return input.slice(12);
  }
}
function extractTags(input, isBigEndian) {
  const tags = {};
  let temp = input;
  while (temp && temp.length) {
    const code = readUInt(temp, 16, 0, isBigEndian);
    const type = readUInt(temp, 16, 2, isBigEndian);
    const length = readUInt(temp, 32, 4, isBigEndian);
    if (code === 0) {
      break;
    } else {
      if (length === 1 && (type === 3 || type === 4)) {
        tags[code] = readValue(temp, isBigEndian);
      }
      temp = nextTag(temp);
    }
  }
  return tags;
}
function determineEndianness(input) {
  const signature = toUTF8String(input, 0, 2);
  if ("II" === signature) {
    return "LE";
  } else if ("MM" === signature) {
    return "BE";
  }
}
const signatures = [
  // '492049', // currently not supported
  "49492a00",
  // Little endian
  "4d4d002a"
  // Big Endian
  // '4d4d002a', // BigTIFF > 4GB. currently not supported
];
const TIFF = {
  validate: (input) => signatures.includes(toHexString(input, 0, 4)),
  calculate(input) {
    const isBigEndian = determineEndianness(input) === "BE";
    const ifdBuffer = readIFD(input, isBigEndian);
    const tags = extractTags(ifdBuffer, isBigEndian);
    const width = tags[256];
    const height = tags[257];
    if (!width || !height) {
      throw new TypeError("Invalid Tiff. Missing tags");
    }
    return { height, width };
  }
};
function calculateExtended(input) {
  return {
    height: 1 + readUInt24LE(input, 7),
    width: 1 + readUInt24LE(input, 4)
  };
}
function calculateLossless(input) {
  return {
    height: 1 + ((input[4] & 15) << 10 | input[3] << 2 | (input[2] & 192) >> 6),
    width: 1 + ((input[2] & 63) << 8 | input[1])
  };
}
function calculateLossy(input) {
  return {
    height: readInt16LE(input, 8) & 16383,
    width: readInt16LE(input, 6) & 16383
  };
}
const WEBP = {
  validate(input) {
    const riffHeader = "RIFF" === toUTF8String(input, 0, 4);
    const webpHeader = "WEBP" === toUTF8String(input, 8, 12);
    const vp8Header = "VP8" === toUTF8String(input, 12, 15);
    return riffHeader && webpHeader && vp8Header;
  },
  calculate(input) {
    const chunkHeader = toUTF8String(input, 12, 16);
    input = input.slice(20, 30);
    if (chunkHeader === "VP8X") {
      const extendedHeader = input[0];
      const validStart = (extendedHeader & 192) === 0;
      const validEnd = (extendedHeader & 1) === 0;
      if (validStart && validEnd) {
        return calculateExtended(input);
      } else {
        throw new TypeError("Invalid WebP");
      }
    }
    if (chunkHeader === "VP8 " && input[0] !== 47) {
      return calculateLossy(input);
    }
    const signature = toHexString(input, 3, 6);
    if (chunkHeader === "VP8L" && signature !== "9d012a") {
      return calculateLossless(input);
    }
    throw new TypeError("Invalid WebP");
  }
};
const typeHandlers = /* @__PURE__ */ new Map([
  ["bmp", BMP],
  ["cur", CUR],
  ["dds", DDS],
  ["gif", GIF],
  ["heif", HEIF],
  ["icns", ICNS],
  ["ico", ICO],
  ["j2c", J2C],
  ["jp2", JP2],
  ["jpg", JPG],
  ["ktx", KTX],
  ["png", PNG],
  ["pnm", PNM],
  ["psd", PSD],
  ["svg", SVG],
  ["tga", TGA],
  ["tiff", TIFF],
  ["webp", WEBP]
]);
const types = Array.from(typeHandlers.keys());
const firstBytes = /* @__PURE__ */ new Map([
  [56, "psd"],
  [66, "bmp"],
  [68, "dds"],
  [71, "gif"],
  [73, "tiff"],
  [77, "tiff"],
  [82, "webp"],
  [105, "icns"],
  [137, "png"],
  [255, "jpg"]
]);
function detector(input) {
  const byte = input[0];
  const type = firstBytes.get(byte);
  if (type && typeHandlers.get(type).validate(input)) {
    return type;
  }
  return types.find((fileType) => typeHandlers.get(fileType).validate(input));
}
const globalOptions = {
  disabledTypes: []
};
function lookup(input) {
  const type = detector(input);
  if (typeof type !== "undefined") {
    if (globalOptions.disabledTypes.indexOf(type) > -1) {
      throw new TypeError("disabled file type: " + type);
    }
    const size = typeHandlers.get(type).calculate(input);
    if (size !== void 0) {
      size.type = size.type ?? type;
      return size;
    }
  }
  throw new TypeError("unsupported file type: " + type);
}
async function probe(url2) {
  const response = await fetch(url2);
  if (!response.body || !response.ok) {
    throw new Error("Failed to fetch image");
  }
  const reader = response.body.getReader();
  let done, value;
  let accumulatedChunks = new Uint8Array();
  while (!done) {
    const readResult = await reader.read();
    done = readResult.done;
    if (done)
      break;
    if (readResult.value) {
      value = readResult.value;
      let tmp = new Uint8Array(accumulatedChunks.length + value.length);
      tmp.set(accumulatedChunks, 0);
      tmp.set(value, accumulatedChunks.length);
      accumulatedChunks = tmp;
      try {
        const dimensions = lookup(accumulatedChunks);
        if (dimensions) {
          await reader.cancel();
          return dimensions;
        }
      } catch (error) {
      }
    }
  }
  throw new Error("Failed to parse the size");
}
async function getConfiguredImageService() {
  if (!globalThis?.astroAsset?.imageService) {
    const { default: service } = await import(
      // @ts-expect-error
      "./astro/assets-service_XQB9jBkQ.mjs"
    ).then((n) => n.s).catch((e) => {
      const error = new AstroError(InvalidImageService);
      error.cause = e;
      throw error;
    });
    if (!globalThis.astroAsset)
      globalThis.astroAsset = {};
    globalThis.astroAsset.imageService = service;
    return service;
  }
  return globalThis.astroAsset.imageService;
}
async function getImage$1(options, imageConfig2) {
  if (!options || typeof options !== "object") {
    throw new AstroError({
      ...ExpectedImageOptions,
      message: ExpectedImageOptions.message(JSON.stringify(options))
    });
  }
  if (typeof options.src === "undefined") {
    throw new AstroError({
      ...ExpectedImage,
      message: ExpectedImage.message(
        options.src,
        "undefined",
        JSON.stringify(options)
      )
    });
  }
  const service = await getConfiguredImageService();
  const resolvedOptions = {
    ...options,
    src: typeof options.src === "object" && "then" in options.src ? (await options.src).default ?? await options.src : options.src
  };
  if (options.inferSize && isRemoteImage(resolvedOptions.src)) {
    try {
      const result = await probe(resolvedOptions.src);
      resolvedOptions.width ??= result.width;
      resolvedOptions.height ??= result.height;
      delete resolvedOptions.inferSize;
    } catch {
      throw new AstroError({
        ...FailedToFetchRemoteImageDimensions,
        message: FailedToFetchRemoteImageDimensions.message(resolvedOptions.src)
      });
    }
  }
  const originalPath = isESMImportedImage(resolvedOptions.src) ? resolvedOptions.src.fsPath : resolvedOptions.src;
  const clonedSrc = isESMImportedImage(resolvedOptions.src) ? (
    // @ts-expect-error - clone is a private, hidden prop
    resolvedOptions.src.clone ?? resolvedOptions.src
  ) : resolvedOptions.src;
  resolvedOptions.src = clonedSrc;
  const validatedOptions = service.validateOptions ? await service.validateOptions(resolvedOptions, imageConfig2) : resolvedOptions;
  const srcSetTransforms = service.getSrcSet ? await service.getSrcSet(validatedOptions, imageConfig2) : [];
  let imageURL = await service.getURL(validatedOptions, imageConfig2);
  let srcSets = await Promise.all(
    srcSetTransforms.map(async (srcSet) => ({
      transform: srcSet.transform,
      url: await service.getURL(srcSet.transform, imageConfig2),
      descriptor: srcSet.descriptor,
      attributes: srcSet.attributes
    }))
  );
  if (isLocalService(service) && globalThis.astroAsset.addStaticImage && !(isRemoteImage(validatedOptions.src) && imageURL === validatedOptions.src)) {
    const propsToHash = service.propertiesToHash ?? DEFAULT_HASH_PROPS;
    imageURL = globalThis.astroAsset.addStaticImage(validatedOptions, propsToHash, originalPath);
    srcSets = srcSetTransforms.map((srcSet) => ({
      transform: srcSet.transform,
      url: globalThis.astroAsset.addStaticImage(srcSet.transform, propsToHash, originalPath),
      descriptor: srcSet.descriptor,
      attributes: srcSet.attributes
    }));
  }
  return {
    rawOptions: resolvedOptions,
    options: validatedOptions,
    src: imageURL,
    srcSet: {
      values: srcSets,
      attribute: srcSets.map((srcSet) => `${srcSet.url} ${srcSet.descriptor}`).join(", ")
    },
    attributes: service.getHTMLAttributes !== void 0 ? await service.getHTMLAttributes(validatedOptions, imageConfig2) : {}
  };
}
const $$Astro$2 = createAstro("https://monochromatic.dev");
const $$Image = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$Image;
  const props = Astro2.props;
  if (props.alt === void 0 || props.alt === null) {
    throw new AstroError(ImageMissingAlt);
  }
  if (typeof props.width === "string") {
    props.width = parseInt(props.width);
  }
  if (typeof props.height === "string") {
    props.height = parseInt(props.height);
  }
  const image = await getImage(props);
  const additionalAttributes = {};
  if (image.srcSet.values.length > 0) {
    additionalAttributes.srcset = image.srcSet.attribute;
  }
  return renderTemplate`${maybeRenderHead()}<img${addAttribute(image.src, "src")}${spreadAttributes(additionalAttributes)}${spreadAttributes(image.attributes)}>`;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/node_modules/astro/components/Image.astro", void 0);
const $$Astro$1 = createAstro("https://monochromatic.dev");
const $$Picture = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$Picture;
  const defaultFormats = ["webp"];
  const defaultFallbackFormat = "png";
  const specialFormatsFallback = ["gif", "svg", "jpg", "jpeg"];
  const { formats = defaultFormats, pictureAttributes = {}, fallbackFormat, ...props } = Astro2.props;
  if (props.alt === void 0 || props.alt === null) {
    throw new AstroError(ImageMissingAlt);
  }
  const optimizedImages = await Promise.all(
    formats.map(
      async (format) => await getImage({ ...props, format, widths: props.widths, densities: props.densities })
    )
  );
  let resultFallbackFormat = fallbackFormat ?? defaultFallbackFormat;
  if (!fallbackFormat && isESMImportedImage(props.src) && specialFormatsFallback.includes(props.src.format)) {
    resultFallbackFormat = props.src.format;
  }
  const fallbackImage = await getImage({
    ...props,
    format: resultFallbackFormat,
    widths: props.widths,
    densities: props.densities
  });
  const imgAdditionalAttributes = {};
  const sourceAdditionalAttributes = {};
  if (props.sizes) {
    sourceAdditionalAttributes.sizes = props.sizes;
  }
  if (fallbackImage.srcSet.values.length > 0) {
    imgAdditionalAttributes.srcset = fallbackImage.srcSet.attribute;
  }
  return renderTemplate`${maybeRenderHead()}<picture${spreadAttributes(pictureAttributes)}> ${Object.entries(optimizedImages).map(([_, image]) => {
    const srcsetAttribute = props.densities || !props.densities && !props.widths ? `${image.src}${image.srcSet.values.length > 0 ? ", " + image.srcSet.attribute : ""}` : image.srcSet.attribute;
    return renderTemplate`<source${addAttribute(srcsetAttribute, "srcset")}${addAttribute("image/" + image.options.format, "type")}${spreadAttributes(sourceAdditionalAttributes)}>`;
  })} <img${addAttribute(fallbackImage.src, "src")}${spreadAttributes(imgAdditionalAttributes)}${spreadAttributes(fallbackImage.attributes)}> </picture>`;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/node_modules/astro/components/Picture.astro", void 0);
const imageConfig = { "service": { "entrypoint": "astro/assets/services/sharp", "config": {} }, "domains": [], "remotePatterns": [] };
const outDir = new URL("file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/dist/");
new URL("_astro", outDir);
const getImage = async (options) => await getImage$1(options, imageConfig);
const MDXLayout$d = async function({
  children
}) {
  const Layout = (await import("./global_DvQrrc-O.mjs")).default;
  const {
    layout,
    ...content
  } = frontmatter$d;
  content.file = file$d;
  content.url = url$d;
  return createVNode(Layout, {
    file: file$d,
    url: url$d,
    content,
    frontmatter: content,
    headings: getHeadings$d(),
    "server:root": true,
    children
  });
};
const frontmatter$d = {
  "layout": "../layouts/global.astro",
  "title": "404",
  "published": "2024MAR07",
  "updated": "2024-03-11T04:08:40.055Z"
};
function getHeadings$d() {
  return [];
}
const __usesAstroImage$d = true;
function _createMdxContent$d(props) {
  const _components = {
    p: "p",
    ...props.components
  };
  return createVNode(_components.p, {
    children: "You’ve landed on an unknown page."
  });
}
function MDXContent$d(props = {}) {
  return createVNode(MDXLayout$d, {
    ...props,
    children: createVNode(_createMdxContent$d, {
      ...props
    })
  });
}
__astro_tag_component__(getHeadings$d, "astro:jsx");
__astro_tag_component__(MDXContent$d, "astro:jsx");
const url$d = "/subtle/404";
const file$d = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/404.mdx";
const Content$d = (props = {}) => MDXContent$d({
  ...props,
  components: { Fragment, ...props.components, "astro-image": props.components?.img ?? $$Image }
});
Content$d[Symbol.for("mdx-component")] = true;
Content$d[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter$d.layout);
Content$d.moduleId = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/404.mdx";
const _404 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Content: Content$d,
  __usesAstroImage: __usesAstroImage$d,
  default: Content$d,
  file: file$d,
  frontmatter: frontmatter$d,
  getHeadings: getHeadings$d,
  url: url$d
}, Symbol.toStringTag, { value: "Module" }));
const MDXLayout$c = async function({
  children
}) {
  const Layout = (await import("./global_DvQrrc-O.mjs")).default;
  const {
    layout,
    ...content
  } = frontmatter$c;
  content.file = file$c;
  content.url = url$c;
  return createVNode(Layout, {
    file: file$c,
    url: url$c,
    content,
    frontmatter: content,
    headings: getHeadings$c(),
    "server:root": true,
    children
  });
};
const frontmatter$c = {
  "layout": "../layouts/global.astro",
  "title": "Links",
  "published": "2024MAR07",
  "updated": "2024-03-08T23:54:58.477Z"
};
function getHeadings$c() {
  return [];
}
const __usesAstroImage$c = true;
function _createMdxContent$c(props) {
  const _components = {
    p: "p",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.p, {
      children: "Here are my friends."
    }), "\n", createVNode(_components.p, {
      children: "Also, people who commissioned or helped me with this project."
    })]
  });
}
function MDXContent$c(props = {}) {
  return createVNode(MDXLayout$c, {
    ...props,
    children: createVNode(_createMdxContent$c, {
      ...props
    })
  });
}
__astro_tag_component__(getHeadings$c, "astro:jsx");
__astro_tag_component__(MDXContent$c, "astro:jsx");
const url$c = "/subtle/links";
const file$c = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/links.mdx";
const Content$c = (props = {}) => MDXContent$c({
  ...props,
  components: { Fragment, ...props.components, "astro-image": props.components?.img ?? $$Image }
});
Content$c[Symbol.for("mdx-component")] = true;
Content$c[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter$c.layout);
Content$c.moduleId = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/links.mdx";
const links$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Content: Content$c,
  __usesAstroImage: __usesAstroImage$c,
  default: Content$c,
  file: file$c,
  frontmatter: frontmatter$c,
  getHeadings: getHeadings$c,
  url: url$c
}, Symbol.toStringTag, { value: "Module" }));
const MDXLayout$b = async function({
  children
}) {
  const Layout = (await import("./global_DvQrrc-O.mjs")).default;
  const {
    layout,
    ...content
  } = frontmatter$b;
  content.file = file$b;
  content.url = url$b;
  return createVNode(Layout, {
    file: file$b,
    url: url$b,
    content,
    frontmatter: content,
    headings: getHeadings$b(),
    "server:root": true,
    children
  });
};
const frontmatter$b = {
  "layout": "../../layouts/global.astro",
  "title": "First post",
  "description": "Lorem ipsum dolor sit amet",
  "published": "Jul 08 2022",
  "tags": ["first", "example"],
  "updated": "2024-03-11T00:08:50.620Z"
};
function getHeadings$b() {
  return [];
}
const __usesAstroImage$b = true;
function _createMdxContent$b(props) {
  const _components = {
    p: "p",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.p, {
      children: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Vitae ultricies leo integer malesuada nunc vel risus commodo viverra. Adipiscing enim eu turpis egestas pretium. Euismod elementum nisi quis eleifend quam adipiscing. In hac habitasse platea dictumst vestibulum. Sagittis purus sit amet volutpat. Netus et malesuada fames ac turpis egestas. Eget magna fermentum iaculis eu non diam phasellus vestibulum lorem. Varius sit amet mattis vulputate enim. Habitasse platea dictumst quisque sagittis. Integer quis auctor elit sed vulputate mi. Dictumst quisque sagittis purus sit amet."
    }), "\n", createVNode(_components.p, {
      children: "Morbi tristique senectus et netus. Id semper risus in hendrerit gravida rutrum quisque non tellus. Habitasse platea dictumst quisque sagittis purus sit amet. Tellus molestie nunc non blandit massa. Cursus vitae congue mauris rhoncus. Accumsan tortor posuere ac ut. Fringilla urna porttitor rhoncus dolor. Elit ullamcorper dignissim cras tincidunt lobortis. In cursus turpis massa tincidunt dui ut ornare lectus. Integer feugiat scelerisque varius morbi enim nunc. Bibendum neque egestas congue quisque egestas diam. Cras ornare arcu dui vivamus arcu felis bibendum. Dignissim suspendisse in est ante in nibh mauris. Sed tempus urna et pharetra pharetra massa massa ultricies mi."
    }), "\n", createVNode(_components.p, {
      children: "Mollis nunc sed id semper risus in. Convallis a cras semper auctor neque. Diam sit amet nisl suscipit. Lacus viverra vitae congue eu consequat ac felis donec. Egestas integer eget aliquet nibh praesent tristique magna sit amet. Eget magna fermentum iaculis eu non diam. In vitae turpis massa sed elementum. Tristique et egestas quis ipsum suspendisse ultrices. Eget lorem dolor sed viverra ipsum. Vel turpis nunc eget lorem dolor sed viverra. Posuere ac ut consequat semper viverra nam. Laoreet suspendisse interdum consectetur libero id faucibus. Diam phasellus vestibulum lorem sed risus ultricies tristique. Rhoncus dolor purus non enim praesent elementum facilisis. Ultrices tincidunt arcu non sodales neque. Tempus egestas sed sed risus pretium quam vulputate. Viverra suspendisse potenti nullam ac tortor vitae purus faucibus ornare. Fringilla urna porttitor rhoncus dolor purus non. Amet dictum sit amet justo donec enim."
    }), "\n", createVNode(_components.p, {
      children: "Mattis ullamcorper velit sed ullamcorper morbi tincidunt. Tortor posuere ac ut consequat semper viverra. Tellus mauris a diam maecenas sed enim ut sem viverra. Venenatis urna cursus eget nunc scelerisque viverra mauris in. Arcu ac tortor dignissim convallis aenean et tortor at. Curabitur gravida arcu ac tortor dignissim convallis aenean et tortor. Egestas tellus rutrum tellus pellentesque eu. Fusce ut placerat orci nulla pellentesque dignissim enim sit amet. Ut enim blandit volutpat maecenas volutpat blandit aliquam etiam. Id donec ultrices tincidunt arcu. Id cursus metus aliquam eleifend mi."
    }), "\n", createVNode(_components.p, {
      children: "Tempus quam pellentesque nec nam aliquam sem. Risus at ultrices mi tempus imperdiet. Id porta nibh venenatis cras sed felis eget velit. Ipsum a arcu cursus vitae. Facilisis magna etiam tempor orci eu lobortis elementum. Tincidunt dui ut ornare lectus sit. Quisque non tellus orci ac. Blandit libero volutpat sed cras. Nec tincidunt praesent semper feugiat nibh sed pulvinar proin gravida. Egestas integer eget aliquet nibh praesent tristique magna."
    })]
  });
}
function MDXContent$b(props = {}) {
  return createVNode(MDXLayout$b, {
    ...props,
    children: createVNode(_createMdxContent$b, {
      ...props
    })
  });
}
__astro_tag_component__(getHeadings$b, "astro:jsx");
__astro_tag_component__(MDXContent$b, "astro:jsx");
const url$b = "/subtle/post/first-post";
const file$b = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/post/first-post.mdx";
const Content$b = (props = {}) => MDXContent$b({
  ...props,
  components: { Fragment, ...props.components, "astro-image": props.components?.img ?? $$Image }
});
Content$b[Symbol.for("mdx-component")] = true;
Content$b[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter$b.layout);
Content$b.moduleId = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/post/first-post.mdx";
const __vite_glob_0_0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Content: Content$b,
  __usesAstroImage: __usesAstroImage$b,
  default: Content$b,
  file: file$b,
  frontmatter: frontmatter$b,
  getHeadings: getHeadings$b,
  url: url$b
}, Symbol.toStringTag, { value: "Module" }));
const $$Astro = createAstro("https://monochromatic.dev");
const $$S = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$S;
  return renderTemplate`${maybeRenderHead()}<section> ${renderSlot($$result, $$slots["default"])} </section>`;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/components/S.astro", void 0);
const MDXLayout$a = async function({
  children
}) {
  const Layout = (await import("./global_DvQrrc-O.mjs")).default;
  const {
    layout,
    ...content
  } = frontmatter$a;
  content.file = file$a;
  content.url = url$a;
  return createVNode(Layout, {
    file: file$a,
    url: url$a,
    content,
    frontmatter: content,
    headings: getHeadings$a(),
    "server:root": true,
    children
  });
};
const frontmatter$a = {
  "layout": "../../layouts/global.astro",
  "title": "Markdown Style Guide",
  "description": "Here is a sample of some basic Markdown syntax that can be used when writing Markdown content in Astro.",
  "published": "Jul 01 2022",
  "tags": ["guide"],
  "updated": "2024-03-14T04:38:12.058Z"
};
function getHeadings$a() {
  return [{
    "depth": 2,
    "slug": "paragraph",
    "text": "Paragraph"
  }, {
    "depth": 2,
    "slug": "images",
    "text": "Images"
  }, {
    "depth": 3,
    "slug": "syntax",
    "text": "Syntax"
  }, {
    "depth": 3,
    "slug": "output",
    "text": "Output"
  }, {
    "depth": 2,
    "slug": "blockquotes",
    "text": "Blockquotes"
  }, {
    "depth": 3,
    "slug": "blockquote-without-attribution",
    "text": "Blockquote without attribution"
  }, {
    "depth": 4,
    "slug": "syntax-1",
    "text": "Syntax"
  }, {
    "depth": 4,
    "slug": "output-1",
    "text": "Output"
  }, {
    "depth": 3,
    "slug": "blockquote-with-attribution",
    "text": "Blockquote with attribution"
  }, {
    "depth": 4,
    "slug": "syntax-2",
    "text": "Syntax"
  }, {
    "depth": 4,
    "slug": "output-2",
    "text": "Output"
  }, {
    "depth": 2,
    "slug": "tables",
    "text": "Tables"
  }, {
    "depth": 3,
    "slug": "syntax-3",
    "text": "Syntax"
  }, {
    "depth": 3,
    "slug": "output-3",
    "text": "Output"
  }, {
    "depth": 2,
    "slug": "code-blocks",
    "text": "Code Blocks"
  }, {
    "depth": 3,
    "slug": "syntax-4",
    "text": "Syntax"
  }, {
    "depth": 3,
    "slug": "output-4",
    "text": "Output"
  }, {
    "depth": 2,
    "slug": "list-types",
    "text": "List Types"
  }, {
    "depth": 3,
    "slug": "ordered-list",
    "text": "Ordered List"
  }, {
    "depth": 4,
    "slug": "syntax-5",
    "text": "Syntax"
  }, {
    "depth": 4,
    "slug": "output-5",
    "text": "Output"
  }, {
    "depth": 3,
    "slug": "unordered-list",
    "text": "Unordered List"
  }, {
    "depth": 4,
    "slug": "syntax-6",
    "text": "Syntax"
  }, {
    "depth": 4,
    "slug": "output-6",
    "text": "Output"
  }, {
    "depth": 3,
    "slug": "nested-list",
    "text": "Nested list"
  }, {
    "depth": 4,
    "slug": "syntax-7",
    "text": "Syntax"
  }, {
    "depth": 4,
    "slug": "output-7",
    "text": "Output"
  }, {
    "depth": 2,
    "slug": "other-elements--abbr-sub-sup-kbd-mark-del",
    "text": "Other Elements — abbr, sub, sup, kbd, mark, del"
  }, {
    "depth": 3,
    "slug": "syntax-8",
    "text": "Syntax"
  }, {
    "depth": 3,
    "slug": "output-8",
    "text": "Output"
  }, {
    "depth": 2,
    "slug": "footnote-label",
    "text": "Footnotes"
  }];
}
const __usesAstroImage$a = true;
function _createMdxContent$a(props) {
  const _components = {
    a: "a",
    blockquote: "blockquote",
    code: "code",
    del: "del",
    em: "em",
    h2: "h2",
    h3: "h3",
    h4: "h4",
    hr: "hr",
    img: "img",
    li: "li",
    ol: "ol",
    p: "p",
    pre: "pre",
    section: "section",
    span: "span",
    strong: "strong",
    sup: "sup",
    table: "table",
    tbody: "tbody",
    td: "td",
    th: "th",
    thead: "thead",
    tr: "tr",
    ul: "ul",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.p, {
      children: "Here is a sample of some basic Markdown syntax that can be used when writing Markdown content in Astro."
    }), "\n", createVNode(_components.hr, {}), "\n", createVNode("section", {
      children: [createVNode(_components.h2, {
        id: "paragraph",
        children: "Paragraph"
      }), createVNode(_components.p, {
        children: "Xerum, quo qui aut unt expliquam qui dolut labo. Aque venitatiusda cum, voluptionse latur sitiae dolessi aut parist aut dollo enim qui voluptate ma dolestendit peritin re plis aut quas inctum laceat est volestemque commosa as cus endigna tectur, offic to cor sequas etum rerum idem sintibus eiur? Quianimin porecus evelectur, cum que nis nust voloribus ratem aut omnimi, sitatur? Quiatem. Nam, omnis sum am facea corem alique molestrunt et eos evelece arcillit ut aut eos eos nus, sin conecerem erum fuga. Ri oditatquam, ad quibus unda veliamenimin cusam et facea ipsamus es exerum sitate dolores editium rerore eost, temped molorro ratiae volorro te reribus dolorer sperchicium faceata tiustia prat."
      }), createVNode(_components.p, {
        children: "Itatur? Quiatae cullecum rem ent aut odis in re eossequodi nonsequ idebis ne sapicia is sinveli squiatum, core et que aut hariosam ex eat."
      })]
    }), "\n", createVNode("section", {
      children: [createVNode(_components.h2, {
        id: "images",
        children: "Images"
      }), createVNode("section", {
        children: [createVNode(_components.h3, {
          id: "syntax",
          children: "Syntax"
        }), createVNode(_components.pre, {
          class: "astro-code astro-code-themes github-light github-dark",
          style: {
            backgroundColor: "#fff",
            "--shiki-dark-bg": "#24292e",
            color: "#24292e",
            "--shiki-dark": "#e1e4e8",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word"
          },
          tabindex: "0",
          children: createVNode(_components.code, {
            children: [createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "!["
              }), createVNode(_components.span, {
                style: {
                  color: "#032F62",
                  "--shiki-dark": "#DBEDFF",
                  textDecoration: "underline",
                  "--shiki-dark-text-decoration": "underline"
                },
                children: "Alt text"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "]("
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8",
                  textDecoration: "underline",
                  "--shiki-dark-text-decoration": "underline"
                },
                children: "./full/or/relative/path/of/image"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ")"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line"
            })]
          })
        })]
      }), createVNode("section", {
        children: [createVNode(_components.h3, {
          id: "output",
          children: "Output"
        }), createVNode(_components.p, {
          children: createVNode(_components.img, {
            src: "/favicon.svg",
            alt: "favicon"
          })
        })]
      })]
    }), "\n", createVNode($$S, {
      children: [createVNode(_components.h2, {
        id: "blockquotes",
        children: "Blockquotes"
      }), createVNode(_components.p, {
        children: ["The blockquote element represents content that is quoted from another source, optionally with a citation which must be within a ", createVNode(_components.code, {
          children: "footer"
        }), " or ", createVNode(_components.code, {
          children: "cite"
        }), " element, and optionally with in-line changes such as annotations and abbreviations."]
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "blockquote-without-attribution",
          children: "Blockquote without attribution"
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "syntax-1",
            children: "Syntax"
          }), createVNode(_components.pre, {
            class: "astro-code astro-code-themes github-light github-dark",
            style: {
              backgroundColor: "#fff",
              "--shiki-dark-bg": "#24292e",
              color: "#24292e",
              "--shiki-dark": "#e1e4e8",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word"
            },
            tabindex: "0",
            children: createVNode(_components.code, {
              children: [createVNode(_components.span, {
                class: "line",
                children: createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "> Tiam, ad mint andaepu dandae nostion secatur sequo quae."
                })
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "> "
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8",
                    fontWeight: "bold",
                    "--shiki-dark-font-weight": "bold"
                  },
                  children: "**Note**"
                }), createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: " that you can use "
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8",
                    fontStyle: "italic",
                    "--shiki-dark-font-style": "italic"
                  },
                  children: "_Markdown syntax_"
                }), createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: " within a blockquote."
                })]
              }), "\n", createVNode(_components.span, {
                class: "line"
              })]
            })
          })]
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "output-1",
            children: "Output"
          }), createVNode(_components.blockquote, {
            children: ["\n", createVNode(_components.p, {
              children: ["Tiam, ad mint andaepu dandae nostion secatur sequo quae.\n", createVNode(_components.strong, {
                children: "Note"
              }), " that you can use ", createVNode(_components.em, {
                children: "Markdown syntax"
              }), " within a blockquote."]
            }), "\n"]
          })]
        })]
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "blockquote-with-attribution",
          children: "Blockquote with attribution"
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "syntax-2",
            children: "Syntax"
          }), createVNode(_components.pre, {
            class: "astro-code astro-code-themes github-light github-dark",
            style: {
              backgroundColor: "#fff",
              "--shiki-dark-bg": "#24292e",
              color: "#24292e",
              "--shiki-dark": "#e1e4e8",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word"
            },
            tabindex: "0",
            children: createVNode(_components.code, {
              children: [createVNode(_components.span, {
                class: "line",
                children: createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "> Don't communicate by sharing memory, share memory by communicating.<br>"
                })
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "> — <cite>Rob Pike["
                }), createVNode(_components.span, {
                  style: {
                    color: "#032F62",
                    "--shiki-dark": "#DBEDFF",
                    textDecoration: "underline",
                    "--shiki-dark-text-decoration": "underline"
                  },
                  children: "^1"
                }), createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "]</cite>"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line"
              })]
            })
          })]
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "output-2",
            children: "Output"
          }), createVNode(_components.blockquote, {
            children: ["\n", createVNode(_components.p, {
              children: "Don’t communicate by sharing memory, share memory by communicating."
            }), "\n", createVNode(_components.p, {
              children: ["— ", createVNode("cite", {
                children: ["Rob Pike", createVNode(_components.sup, {
                  children: createVNode(_components.a, {
                    href: "#user-content-fn-1",
                    id: "user-content-fnref-1",
                    "data-footnote-ref": "",
                    "aria-describedby": "footnote-label",
                    children: "1"
                  })
                })]
              })]
            }), "\n"]
          })]
        })]
      })]
    }), "\n", createVNode($$S, {
      children: [createVNode(_components.h2, {
        id: "tables",
        children: "Tables"
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "syntax-3",
          children: "Syntax"
        }), createVNode(_components.pre, {
          class: "astro-code astro-code-themes github-light github-dark",
          style: {
            backgroundColor: "#fff",
            "--shiki-dark-bg": "#24292e",
            color: "#24292e",
            "--shiki-dark": "#e1e4e8",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word"
          },
          tabindex: "0",
          children: createVNode(_components.code, {
            children: [createVNode(_components.span, {
              class: "line",
              children: createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "| Italics   | Bold     | Code   |"
              })
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "| --------- | -------- | ------ |"
              })
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "| "
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8",
                  fontStyle: "italic",
                  "--shiki-dark-font-style": "italic"
                },
                children: "_italics_"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: " | "
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8",
                  fontWeight: "bold",
                  "--shiki-dark-font-weight": "bold"
                },
                children: "**bold**"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: " | "
              }), createVNode(_components.span, {
                style: {
                  color: "#005CC5",
                  "--shiki-dark": "#79B8FF"
                },
                children: "`code`"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: " |"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line"
            })]
          })
        })]
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "output-3",
          children: "Output"
        }), "\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n", createVNode(_components.table, {
          children: [createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [createVNode(_components.th, {
                children: "Italics"
              }), createVNode(_components.th, {
                children: "Bold"
              }), createVNode(_components.th, {
                children: "Code"
              })]
            })
          }), createVNode(_components.tbody, {
            children: [createVNode(_components.tr, {
              children: [createVNode(_components.td, {
                children: createVNode(_components.em, {
                  children: "italics"
                })
              }), createVNode(_components.td, {
                children: createVNode(_components.strong, {
                  children: "bold"
                })
              }), createVNode(_components.td, {
                children: createVNode(_components.code, {
                  children: "code"
                })
              })]
            }), createVNode(_components.tr, {
              children: [createVNode(_components.td, {
                children: createVNode(_components.em, {
                  children: "italics"
                })
              }), createVNode(_components.td, {
                children: createVNode(_components.strong, {
                  children: "bold"
                })
              }), createVNode(_components.td, {
                children: createVNode(_components.code, {
                  children: "code"
                })
              })]
            })]
          })]
        })]
      })]
    }), "\n", createVNode($$S, {
      children: [createVNode(_components.h2, {
        id: "code-blocks",
        children: "Code Blocks"
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "syntax-4",
          children: "Syntax"
        }), createVNode(_components.p, {
          children: "we can use 3 backticks ``` in new line and write snippet and close with 3 backticks on new line and to highlight language specific syntac, write one word of language name after first 3 backticks, for eg. html, javascript, css, markdown, typescript, txt, bash"
        }), createVNode(_components.pre, {
          class: "astro-code astro-code-themes github-light github-dark",
          style: {
            backgroundColor: "#fff",
            "--shiki-dark-bg": "#24292e",
            color: "#24292e",
            "--shiki-dark": "#e1e4e8",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word"
          },
          tabindex: "0",
          children: createVNode(_components.code, {
            children: [createVNode(_components.span, {
              class: "line",
              children: createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "```html"
              })
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "<!"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "doctype"
              }), createVNode(_components.span, {
                style: {
                  color: "#6F42C1",
                  "--shiki-dark": "#B392F0"
                },
                children: " html"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "<"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "html"
              }), createVNode(_components.span, {
                style: {
                  color: "#6F42C1",
                  "--shiki-dark": "#B392F0"
                },
                children: " lang"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "="
              }), createVNode(_components.span, {
                style: {
                  color: "#032F62",
                  "--shiki-dark": "#9ECBFF"
                },
                children: '"en"'
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "  <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "head"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "    <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "meta"
              }), createVNode(_components.span, {
                style: {
                  color: "#6F42C1",
                  "--shiki-dark": "#B392F0"
                },
                children: " charset"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "="
              }), createVNode(_components.span, {
                style: {
                  color: "#032F62",
                  "--shiki-dark": "#9ECBFF"
                },
                children: '"utf-8"'
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: " />"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "    <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "title"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">Example HTML5 Document</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "title"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "  </"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "head"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "  <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "body"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "    <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "p"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">Test</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "p"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "  </"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "body"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "html"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "```"
              })
            }), "\n", createVNode(_components.span, {
              class: "line"
            })]
          })
        })]
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "output-4",
          children: "Output"
        }), createVNode(_components.pre, {
          class: "astro-code astro-code-themes github-light github-dark",
          style: {
            backgroundColor: "#fff",
            "--shiki-dark-bg": "#24292e",
            color: "#24292e",
            "--shiki-dark": "#e1e4e8",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word"
          },
          tabindex: "0",
          children: createVNode(_components.code, {
            children: [createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "<!"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "doctype"
              }), createVNode(_components.span, {
                style: {
                  color: "#6F42C1",
                  "--shiki-dark": "#B392F0"
                },
                children: " html"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "<"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "html"
              }), createVNode(_components.span, {
                style: {
                  color: "#6F42C1",
                  "--shiki-dark": "#B392F0"
                },
                children: " lang"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "="
              }), createVNode(_components.span, {
                style: {
                  color: "#032F62",
                  "--shiki-dark": "#9ECBFF"
                },
                children: '"en"'
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "  <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "head"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "    <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "meta"
              }), createVNode(_components.span, {
                style: {
                  color: "#6F42C1",
                  "--shiki-dark": "#B392F0"
                },
                children: " charset"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "="
              }), createVNode(_components.span, {
                style: {
                  color: "#032F62",
                  "--shiki-dark": "#9ECBFF"
                },
                children: '"utf-8"'
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: " />"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "    <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "title"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">Example HTML5 Document</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "title"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "  </"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "head"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "  <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "body"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "    <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "p"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">Test</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "p"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "  </"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "body"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "html"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line"
            })]
          })
        })]
      })]
    }), "\n", createVNode($$S, {
      children: [createVNode(_components.h2, {
        id: "list-types",
        children: "List Types"
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "ordered-list",
          children: "Ordered List"
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "syntax-5",
            children: "Syntax"
          }), createVNode(_components.pre, {
            class: "astro-code astro-code-themes github-light github-dark",
            style: {
              backgroundColor: "#fff",
              "--shiki-dark-bg": "#24292e",
              color: "#24292e",
              "--shiki-dark": "#e1e4e8",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word"
            },
            tabindex: "0",
            children: createVNode(_components.code, {
              children: [createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "1."
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " First item"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "2."
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " Second item"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "3."
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " Third item"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line"
              })]
            })
          })]
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "output-5",
            children: "Output"
          }), createVNode(_components.ol, {
            children: ["\n", createVNode(_components.li, {
              children: "First item"
            }), "\n", createVNode(_components.li, {
              children: "Second item"
            }), "\n", createVNode(_components.li, {
              children: "Third item"
            }), "\n"]
          })]
        })]
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "unordered-list",
          children: "Unordered List"
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "syntax-6",
            children: "Syntax"
          }), createVNode(_components.pre, {
            class: "astro-code astro-code-themes github-light github-dark",
            style: {
              backgroundColor: "#fff",
              "--shiki-dark-bg": "#24292e",
              color: "#24292e",
              "--shiki-dark": "#e1e4e8",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word"
            },
            tabindex: "0",
            children: createVNode(_components.code, {
              children: [createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "-"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " List item"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "-"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " Another item"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "-"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " And another item"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line"
              })]
            })
          })]
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "output-6",
            children: "Output"
          }), createVNode(_components.ul, {
            children: ["\n", createVNode(_components.li, {
              children: "List item"
            }), "\n", createVNode(_components.li, {
              children: "Another item"
            }), "\n", createVNode(_components.li, {
              children: "And another item"
            }), "\n"]
          })]
        })]
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "nested-list",
          children: "Nested list"
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "syntax-7",
            children: "Syntax"
          }), createVNode(_components.pre, {
            class: "astro-code astro-code-themes github-light github-dark",
            style: {
              backgroundColor: "#fff",
              "--shiki-dark-bg": "#24292e",
              color: "#24292e",
              "--shiki-dark": "#e1e4e8",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word"
            },
            tabindex: "0",
            children: createVNode(_components.code, {
              children: [createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "-"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " <"
                }), createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "p"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: ">Fruit</"
                }), createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "p"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: ">"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "  -"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " Apple"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "  -"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " Orange"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "  -"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " Banana"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "-"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " <"
                }), createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "p"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: ">Dairy</"
                }), createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "p"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: ">"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "  1."
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " Milk"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "  2."
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " Cheese"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line"
              })]
            })
          })]
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "output-7",
            children: "Output"
          }), createVNode(_components.ul, {
            children: ["\n", createVNode(_components.li, {
              children: ["\n", createVNode("p", {
                children: "Fruit"
              }), "\n", createVNode(_components.ul, {
                children: ["\n", createVNode(_components.li, {
                  children: "Apple"
                }), "\n", createVNode(_components.li, {
                  children: "Orange"
                }), "\n", createVNode(_components.li, {
                  children: "Banana"
                }), "\n"]
              }), "\n"]
            }), "\n", createVNode(_components.li, {
              children: ["\n", createVNode("p", {
                children: "Dairy"
              }), "\n", createVNode(_components.ol, {
                children: ["\n", createVNode(_components.li, {
                  children: "Milk"
                }), "\n", createVNode(_components.li, {
                  children: "Cheese"
                }), "\n"]
              }), "\n"]
            }), "\n"]
          })]
        })]
      })]
    }), "\n", createVNode($$S, {
      children: [createVNode(_components.h2, {
        id: "other-elements--abbr-sub-sup-kbd-mark-del",
        children: "Other Elements — abbr, sub, sup, kbd, mark, del"
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "syntax-8",
          children: "Syntax"
        }), createVNode(_components.pre, {
          class: "astro-code astro-code-themes github-light github-dark",
          style: {
            backgroundColor: "#fff",
            "--shiki-dark-bg": "#24292e",
            color: "#24292e",
            "--shiki-dark": "#e1e4e8",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word"
          },
          tabindex: "0",
          children: createVNode(_components.code, {
            children: [createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "<"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "abbr"
              }), createVNode(_components.span, {
                style: {
                  color: "#6F42C1",
                  "--shiki-dark": "#B392F0"
                },
                children: " title"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "="
              }), createVNode(_components.span, {
                style: {
                  color: "#032F62",
                  "--shiki-dark": "#9ECBFF"
                },
                children: '"Graphics Interchange Format"'
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">GIF</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "abbr"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "> is a bitmap image format."
              })]
            }), "\n", createVNode(_components.span, {
              class: "line"
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "H<"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "sub"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">2</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "sub"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">O"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line"
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "X<"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "sup"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">n</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "sup"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "> + Y<"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "sup"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">n</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "sup"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "> = Z<"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "sup"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">n</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "sup"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line"
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "Press <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "kbd"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">CTRL</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "kbd"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "> + <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "kbd"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">ALT</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "kbd"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "> + <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "kbd"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">Delete</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "kbd"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "> to end the session."
              })]
            }), "\n", createVNode(_components.span, {
              class: "line"
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "Most <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "mark"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">salamanders</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "mark"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "> are nocturnal, and hunt for insects, worms, and other small creatures."
              })]
            }), "\n", createVNode(_components.span, {
              class: "line"
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "~strikethrough~"
              })
            }), "\n", createVNode(_components.span, {
              class: "line"
            })]
          })
        })]
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "output-8",
          children: "Output"
        }), createVNode(_components.p, {
          children: [createVNode("abbr", {
            title: "Graphics Interchange Format",
            children: "GIF"
          }), " is a bitmap image format."]
        }), createVNode(_components.p, {
          children: ["H", createVNode("sub", {
            children: "2"
          }), "O"]
        }), createVNode(_components.p, {
          children: ["X", createVNode("sup", {
            children: "n"
          }), " + Y", createVNode("sup", {
            children: "n"
          }), " = Z", createVNode("sup", {
            children: "n"
          })]
        }), createVNode(_components.p, {
          children: ["Press ", createVNode("kbd", {
            children: "CTRL"
          }), " + ", createVNode("kbd", {
            children: "ALT"
          }), " + ", createVNode("kbd", {
            children: "Delete"
          }), " to end the session."]
        }), createVNode(_components.p, {
          children: ["Most ", createVNode("mark", {
            children: "salamanders"
          }), " are nocturnal, and hunt for insects, worms, and other small creatures."]
        }), createVNode(_components.p, {
          children: createVNode(_components.del, {
            children: "strikethrough"
          })
        })]
      })]
    }), "\n", "\n", createVNode(_components.section, {
      "data-footnotes": "",
      class: "footnotes",
      children: [createVNode(_components.h2, {
        class: "sr-only",
        id: "footnote-label",
        children: "Footnotes"
      }), "\n", createVNode(_components.ol, {
        children: ["\n", createVNode(_components.li, {
          id: "user-content-fn-1",
          children: ["\n", createVNode(_components.p, {
            children: ["The above quote is excerpted from Rob Pike’s ", createVNode(_components.a, {
              href: "https://www.youtube.com/watch?v=PAAkCSZUG1c",
              children: "talk"
            }), " during Gopherfest, November 18, 2015. ", createVNode(_components.a, {
              href: "#user-content-fnref-1",
              "data-footnote-backref": "",
              "aria-label": "Back to reference 1",
              class: "data-footnote-backref",
              children: "↩"
            })]
          }), "\n"]
        }), "\n"]
      }), "\n"]
    })]
  });
}
function MDXContent$a(props = {}) {
  return createVNode(MDXLayout$a, {
    ...props,
    children: createVNode(_createMdxContent$a, {
      ...props
    })
  });
}
__astro_tag_component__(getHeadings$a, "astro:jsx");
__astro_tag_component__(MDXContent$a, "astro:jsx");
const url$a = "/subtle/post/markdown-style-guide";
const file$a = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/post/markdown-style-guide.mdx";
const Content$a = (props = {}) => MDXContent$a({
  ...props,
  components: { Fragment, ...props.components, "astro-image": props.components?.img ?? $$Image }
});
Content$a[Symbol.for("mdx-component")] = true;
Content$a[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter$a.layout);
Content$a.moduleId = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/post/markdown-style-guide.mdx";
const __vite_glob_0_1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Content: Content$a,
  __usesAstroImage: __usesAstroImage$a,
  default: Content$a,
  file: file$a,
  frontmatter: frontmatter$a,
  getHeadings: getHeadings$a,
  url: url$a
}, Symbol.toStringTag, { value: "Module" }));
const MDXLayout$9 = async function({
  children
}) {
  const Layout = (await import("./global_DvQrrc-O.mjs")).default;
  const {
    layout,
    ...content
  } = frontmatter$9;
  content.file = file$9;
  content.url = url$9;
  return createVNode(Layout, {
    file: file$9,
    url: url$9,
    content,
    frontmatter: content,
    headings: getHeadings$9(),
    "server:root": true,
    children
  });
};
const frontmatter$9 = {
  "layout": "../../layouts/global.astro",
  "title": "Second post",
  "description": "Lorem ipsum dolor sit amet",
  "published": "Jul 15 2022",
  "tags": ["example"],
  "updated": "2024-03-11T00:08:50.616Z"
};
function getHeadings$9() {
  return [];
}
const __usesAstroImage$9 = true;
function _createMdxContent$9(props) {
  const _components = {
    p: "p",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.p, {
      children: "Morbi tristique senectus et netus. Id semper risus in hendrerit gravida rutrum quisque non tellus. Habitasse platea dictumst quisque sagittis purus sit amet. Tellus molestie nunc non blandit massa. Cursus vitae congue mauris rhoncus. Accumsan tortor posuere ac ut. Fringilla urna porttitor rhoncus dolor. Elit ullamcorper dignissim cras tincidunt lobortis. In cursus turpis massa tincidunt dui ut ornare lectus. Integer feugiat scelerisque varius morbi enim nunc. Bibendum neque egestas congue quisque egestas diam. Cras ornare arcu dui vivamus arcu felis bibendum. Dignissim suspendisse in est ante in nibh mauris. Sed tempus urna et pharetra pharetra massa massa ultricies mi."
    }), "\n", createVNode(_components.p, {
      children: "Mollis nunc sed id semper risus in. Convallis a cras semper auctor neque. Diam sit amet nisl suscipit. Lacus viverra vitae congue eu consequat ac felis donec. Egestas integer eget aliquet nibh praesent tristique magna sit amet. Eget magna fermentum iaculis eu non diam. In vitae turpis massa sed elementum. Tristique et egestas quis ipsum suspendisse ultrices. Eget lorem dolor sed viverra ipsum. Vel turpis nunc eget lorem dolor sed viverra. Posuere ac ut consequat semper viverra nam. Laoreet suspendisse interdum consectetur libero id faucibus. Diam phasellus vestibulum lorem sed risus ultricies tristique. Rhoncus dolor purus non enim praesent elementum facilisis. Ultrices tincidunt arcu non sodales neque. Tempus egestas sed sed risus pretium quam vulputate. Viverra suspendisse potenti nullam ac tortor vitae purus faucibus ornare. Fringilla urna porttitor rhoncus dolor purus non. Amet dictum sit amet justo donec enim."
    }), "\n", createVNode(_components.p, {
      children: "Mattis ullamcorper velit sed ullamcorper morbi tincidunt. Tortor posuere ac ut consequat semper viverra. Tellus mauris a diam maecenas sed enim ut sem viverra. Venenatis urna cursus eget nunc scelerisque viverra mauris in. Arcu ac tortor dignissim convallis aenean et tortor at. Curabitur gravida arcu ac tortor dignissim convallis aenean et tortor. Egestas tellus rutrum tellus pellentesque eu. Fusce ut placerat orci nulla pellentesque dignissim enim sit amet. Ut enim blandit volutpat maecenas volutpat blandit aliquam etiam. Id donec ultrices tincidunt arcu. Id cursus metus aliquam eleifend mi."
    }), "\n", createVNode(_components.p, {
      children: "Tempus quam pellentesque nec nam aliquam sem. Risus at ultrices mi tempus imperdiet. Id porta nibh venenatis cras sed felis eget velit. Ipsum a arcu cursus vitae. Facilisis magna etiam tempor orci eu lobortis elementum. Tincidunt dui ut ornare lectus sit. Quisque non tellus orci ac. Blandit libero volutpat sed cras. Nec tincidunt praesent semper feugiat nibh sed pulvinar proin gravida. Egestas integer eget aliquet nibh praesent tristique magna."
    })]
  });
}
function MDXContent$9(props = {}) {
  return createVNode(MDXLayout$9, {
    ...props,
    children: createVNode(_createMdxContent$9, {
      ...props
    })
  });
}
__astro_tag_component__(getHeadings$9, "astro:jsx");
__astro_tag_component__(MDXContent$9, "astro:jsx");
const url$9 = "/subtle/post/second-post";
const file$9 = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/post/second-post.mdx";
const Content$9 = (props = {}) => MDXContent$9({
  ...props,
  components: { Fragment, ...props.components, "astro-image": props.components?.img ?? $$Image }
});
Content$9[Symbol.for("mdx-component")] = true;
Content$9[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter$9.layout);
Content$9.moduleId = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/post/second-post.mdx";
const __vite_glob_0_2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Content: Content$9,
  __usesAstroImage: __usesAstroImage$9,
  default: Content$9,
  file: file$9,
  frontmatter: frontmatter$9,
  getHeadings: getHeadings$9,
  url: url$9
}, Symbol.toStringTag, { value: "Module" }));
const MDXLayout$8 = async function({
  children
}) {
  const Layout = (await import("./global_DvQrrc-O.mjs")).default;
  const {
    layout,
    ...content
  } = frontmatter$8;
  content.file = file$8;
  content.url = url$8;
  return createVNode(Layout, {
    file: file$8,
    url: url$8,
    content,
    frontmatter: content,
    headings: getHeadings$8(),
    "server:root": true,
    children
  });
};
const frontmatter$8 = {
  "layout": "../../layouts/global.astro",
  "title": "Third post",
  "description": "Lorem ipsum dolor sit amet",
  "published": "Jul 22 2022",
  "tags": ["example"],
  "updated": "2024-03-11T00:08:50.616Z"
};
function getHeadings$8() {
  return [];
}
const __usesAstroImage$8 = true;
function _createMdxContent$8(props) {
  const _components = {
    p: "p",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.p, {
      children: "Mollis nunc sed id semper risus in. Convallis a cras semper auctor neque. Diam sit amet nisl suscipit. Lacus viverra vitae congue eu consequat ac felis donec. Egestas integer eget aliquet nibh praesent tristique magna sit amet. Eget magna fermentum iaculis eu non diam. In vitae turpis massa sed elementum. Tristique et egestas quis ipsum suspendisse ultrices. Eget lorem dolor sed viverra ipsum. Vel turpis nunc eget lorem dolor sed viverra. Posuere ac ut consequat semper viverra nam. Laoreet suspendisse interdum consectetur libero id faucibus. Diam phasellus vestibulum lorem sed risus ultricies tristique. Rhoncus dolor purus non enim praesent elementum facilisis. Ultrices tincidunt arcu non sodales neque. Tempus egestas sed sed risus pretium quam vulputate. Viverra suspendisse potenti nullam ac tortor vitae purus faucibus ornare. Fringilla urna porttitor rhoncus dolor purus non. Amet dictum sit amet justo donec enim."
    }), "\n", createVNode(_components.p, {
      children: "Mattis ullamcorper velit sed ullamcorper morbi tincidunt. Tortor posuere ac ut consequat semper viverra. Tellus mauris a diam maecenas sed enim ut sem viverra. Venenatis urna cursus eget nunc scelerisque viverra mauris in. Arcu ac tortor dignissim convallis aenean et tortor at. Curabitur gravida arcu ac tortor dignissim convallis aenean et tortor. Egestas tellus rutrum tellus pellentesque eu. Fusce ut placerat orci nulla pellentesque dignissim enim sit amet. Ut enim blandit volutpat maecenas volutpat blandit aliquam etiam. Id donec ultrices tincidunt arcu. Id cursus metus aliquam eleifend mi."
    }), "\n", createVNode(_components.p, {
      children: "Tempus quam pellentesque nec nam aliquam sem. Risus at ultrices mi tempus imperdiet. Id porta nibh venenatis cras sed felis eget velit. Ipsum a arcu cursus vitae. Facilisis magna etiam tempor orci eu lobortis elementum. Tincidunt dui ut ornare lectus sit. Quisque non tellus orci ac. Blandit libero volutpat sed cras. Nec tincidunt praesent semper feugiat nibh sed pulvinar proin gravida. Egestas integer eget aliquet nibh praesent tristique magna."
    })]
  });
}
function MDXContent$8(props = {}) {
  return createVNode(MDXLayout$8, {
    ...props,
    children: createVNode(_createMdxContent$8, {
      ...props
    })
  });
}
__astro_tag_component__(getHeadings$8, "astro:jsx");
__astro_tag_component__(MDXContent$8, "astro:jsx");
const url$8 = "/subtle/post/third-post";
const file$8 = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/post/third-post.mdx";
const Content$8 = (props = {}) => MDXContent$8({
  ...props,
  components: { Fragment, ...props.components, "astro-image": props.components?.img ?? $$Image }
});
Content$8[Symbol.for("mdx-component")] = true;
Content$8[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter$8.layout);
Content$8.moduleId = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/post/third-post.mdx";
const __vite_glob_0_3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Content: Content$8,
  __usesAstroImage: __usesAstroImage$8,
  default: Content$8,
  file: file$8,
  frontmatter: frontmatter$8,
  getHeadings: getHeadings$8,
  url: url$8
}, Symbol.toStringTag, { value: "Module" }));
const MDXLayout$7 = async function({
  children
}) {
  const Layout = (await import("./global_DvQrrc-O.mjs")).default;
  const {
    layout,
    ...content
  } = frontmatter$7;
  content.file = file$7;
  content.url = url$7;
  return createVNode(Layout, {
    file: file$7,
    url: url$7,
    content,
    frontmatter: content,
    headings: getHeadings$7(),
    "server:root": true,
    children
  });
};
const frontmatter$7 = {
  "layout": "../../layouts/global.astro",
  "title": "Using MDX",
  "description": "Lorem ipsum dolor sit amet",
  "published": "Jul 02 2022",
  "tags": ["example", "guide"],
  "updated": "2024-03-11T00:08:50.616Z"
};
function getHeadings$7() {
  return [{
    "depth": 2,
    "slug": "why-mdx",
    "text": "Why MDX?"
  }, {
    "depth": 2,
    "slug": "example",
    "text": "Example"
  }, {
    "depth": 2,
    "slug": "more-links",
    "text": "More Links"
  }];
}
const __usesAstroImage$7 = true;
function _createMdxContent$7(props) {
  const _components = {
    a: "a",
    code: "code",
    h2: "h2",
    li: "li",
    p: "p",
    strong: "strong",
    ul: "ul",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.p, {
      children: ["This theme comes with the ", createVNode(_components.a, {
        href: "https://docs.astro.build/en/guides/integrations-guide/mdx/",
        children: "@astrojs/mdx"
      }), " integration installed and configured in your ", createVNode(_components.code, {
        children: "astro.config.mjs"
      }), " config file. If you prefer not to use MDX, you can disable support by removing the integration from your config file."]
    }), "\n", createVNode(_components.h2, {
      id: "why-mdx",
      children: "Why MDX?"
    }), "\n", createVNode(_components.p, {
      children: ["MDX is a special flavor of Markdown that supports embedded JavaScript & JSX syntax. This unlocks the ability to ", createVNode(_components.a, {
        href: "https://docs.astro.build/en/guides/markdown-content/#mdx-features",
        children: "mix JavaScript and UI Components into your Markdown content"
      }), " for things like interactive charts or alerts."]
    }), "\n", createVNode(_components.p, {
      children: "If you have existing content authored in MDX, this integration will hopefully make migrating to Astro a breeze."
    }), "\n", createVNode(_components.h2, {
      id: "example",
      children: "Example"
    }), "\n", createVNode(_components.p, {
      children: "Here is how you import and use a UI component inside of MDX.\nWhen you open this page in the browser, you should see the clickable button below."
    }), "\n", createVNode(_components.h2, {
      id: "more-links",
      children: "More Links"
    }), "\n", createVNode(_components.ul, {
      children: ["\n", createVNode(_components.li, {
        children: createVNode(_components.a, {
          href: "https://mdxjs.com/docs/what-is-mdx",
          children: "MDX Syntax Documentation"
        })
      }), "\n", createVNode(_components.li, {
        children: createVNode(_components.a, {
          href: "https://docs.astro.build/en/guides/markdown-content/#markdown-and-mdx-pages",
          children: "Astro Usage Documentation"
        })
      }), "\n", createVNode(_components.li, {
        children: [createVNode(_components.strong, {
          children: "Note:"
        }), " ", createVNode(_components.a, {
          href: "https://docs.astro.build/en/reference/directives-reference/#client-directives",
          children: "Client Directives"
        }), " are still required to create interactive components. Otherwise, all components in your MDX will render as static HTML (no JavaScript) by default."]
      }), "\n"]
    })]
  });
}
function MDXContent$7(props = {}) {
  return createVNode(MDXLayout$7, {
    ...props,
    children: createVNode(_createMdxContent$7, {
      ...props
    })
  });
}
__astro_tag_component__(getHeadings$7, "astro:jsx");
__astro_tag_component__(MDXContent$7, "astro:jsx");
const url$7 = "/subtle/post/using-mdx";
const file$7 = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/post/using-mdx.mdx";
const Content$7 = (props = {}) => MDXContent$7({
  ...props,
  components: { Fragment, ...props.components, "astro-image": props.components?.img ?? $$Image }
});
Content$7[Symbol.for("mdx-component")] = true;
Content$7[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter$7.layout);
Content$7.moduleId = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/post/using-mdx.mdx";
const __vite_glob_0_4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Content: Content$7,
  __usesAstroImage: __usesAstroImage$7,
  default: Content$7,
  file: file$7,
  frontmatter: frontmatter$7,
  getHeadings: getHeadings$7,
  url: url$7
}, Symbol.toStringTag, { value: "Module" }));
const MDXLayout$6 = async function({
  children
}) {
  const Layout = (await import("./global_DvQrrc-O.mjs")).default;
  const {
    layout,
    ...content
  } = frontmatter$6;
  content.file = file$6;
  content.url = url$6;
  return createVNode(Layout, {
    file: file$6,
    url: url$6,
    content,
    frontmatter: content,
    headings: getHeadings$6(),
    "server:root": true,
    children
  });
};
const frontmatter$6 = {
  "layout": "../../../layouts/global.astro",
  "title": "第一篇",
  "description": "Lorem ipsum dolor sit amet",
  "published": "Jul 08 2022",
  "tags": ["first", "example"],
  "updated": "2024-03-14T07:17:37.514Z"
};
function getHeadings$6() {
  return [];
}
const __usesAstroImage$6 = true;
function _createMdxContent$6(props) {
  const _components = {
    p: "p",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.p, {
      children: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Vitae ultricies leo integer malesuada nunc vel risus commodo viverra. Adipiscing enim eu turpis egestas pretium. Euismod elementum nisi quis eleifend quam adipiscing. In hac habitasse platea dictumst vestibulum. Sagittis purus sit amet volutpat. Netus et malesuada fames ac turpis egestas. Eget magna fermentum iaculis eu non diam phasellus vestibulum lorem. Varius sit amet mattis vulputate enim. Habitasse platea dictumst quisque sagittis. Integer quis auctor elit sed vulputate mi. Dictumst quisque sagittis purus sit amet."
    }), "\n", createVNode(_components.p, {
      children: "Morbi tristique senectus et netus. Id semper risus in hendrerit gravida rutrum quisque non tellus. Habitasse platea dictumst quisque sagittis purus sit amet. Tellus molestie nunc non blandit massa. Cursus vitae congue mauris rhoncus. Accumsan tortor posuere ac ut. Fringilla urna porttitor rhoncus dolor. Elit ullamcorper dignissim cras tincidunt lobortis. In cursus turpis massa tincidunt dui ut ornare lectus. Integer feugiat scelerisque varius morbi enim nunc. Bibendum neque egestas congue quisque egestas diam. Cras ornare arcu dui vivamus arcu felis bibendum. Dignissim suspendisse in est ante in nibh mauris. Sed tempus urna et pharetra pharetra massa massa ultricies mi."
    }), "\n", createVNode(_components.p, {
      children: "Mollis nunc sed id semper risus in. Convallis a cras semper auctor neque. Diam sit amet nisl suscipit. Lacus viverra vitae congue eu consequat ac felis donec. Egestas integer eget aliquet nibh praesent tristique magna sit amet. Eget magna fermentum iaculis eu non diam. In vitae turpis massa sed elementum. Tristique et egestas quis ipsum suspendisse ultrices. Eget lorem dolor sed viverra ipsum. Vel turpis nunc eget lorem dolor sed viverra. Posuere ac ut consequat semper viverra nam. Laoreet suspendisse interdum consectetur libero id faucibus. Diam phasellus vestibulum lorem sed risus ultricies tristique. Rhoncus dolor purus non enim praesent elementum facilisis. Ultrices tincidunt arcu non sodales neque. Tempus egestas sed sed risus pretium quam vulputate. Viverra suspendisse potenti nullam ac tortor vitae purus faucibus ornare. Fringilla urna porttitor rhoncus dolor purus non. Amet dictum sit amet justo donec enim."
    }), "\n", createVNode(_components.p, {
      children: "Mattis ullamcorper velit sed ullamcorper morbi tincidunt. Tortor posuere ac ut consequat semper viverra. Tellus mauris a diam maecenas sed enim ut sem viverra. Venenatis urna cursus eget nunc scelerisque viverra mauris in. Arcu ac tortor dignissim convallis aenean et tortor at. Curabitur gravida arcu ac tortor dignissim convallis aenean et tortor. Egestas tellus rutrum tellus pellentesque eu. Fusce ut placerat orci nulla pellentesque dignissim enim sit amet. Ut enim blandit volutpat maecenas volutpat blandit aliquam etiam. Id donec ultrices tincidunt arcu. Id cursus metus aliquam eleifend mi."
    }), "\n", createVNode(_components.p, {
      children: "Tempus quam pellentesque nec nam aliquam sem. Risus at ultrices mi tempus imperdiet. Id porta nibh venenatis cras sed felis eget velit. Ipsum a arcu cursus vitae. Facilisis magna etiam tempor orci eu lobortis elementum. Tincidunt dui ut ornare lectus sit. Quisque non tellus orci ac. Blandit libero volutpat sed cras. Nec tincidunt praesent semper feugiat nibh sed pulvinar proin gravida. Egestas integer eget aliquet nibh praesent tristique magna."
    })]
  });
}
function MDXContent$6(props = {}) {
  return createVNode(MDXLayout$6, {
    ...props,
    children: createVNode(_createMdxContent$6, {
      ...props
    })
  });
}
__astro_tag_component__(getHeadings$6, "astro:jsx");
__astro_tag_component__(MDXContent$6, "astro:jsx");
const url$6 = "/subtle/zh/post/first-post";
const file$6 = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/zh/post/first-post.mdx";
const Content$6 = (props = {}) => MDXContent$6({
  ...props,
  components: { Fragment, ...props.components, "astro-image": props.components?.img ?? $$Image }
});
Content$6[Symbol.for("mdx-component")] = true;
Content$6[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter$6.layout);
Content$6.moduleId = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/zh/post/first-post.mdx";
const __vite_glob_0_5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Content: Content$6,
  __usesAstroImage: __usesAstroImage$6,
  default: Content$6,
  file: file$6,
  frontmatter: frontmatter$6,
  getHeadings: getHeadings$6,
  url: url$6
}, Symbol.toStringTag, { value: "Module" }));
const MDXLayout$5 = async function({
  children
}) {
  const Layout = (await import("./global_DvQrrc-O.mjs")).default;
  const {
    layout,
    ...content
  } = frontmatter$5;
  content.file = file$5;
  content.url = url$5;
  return createVNode(Layout, {
    file: file$5,
    url: url$5,
    content,
    frontmatter: content,
    headings: getHeadings$5(),
    "server:root": true,
    children
  });
};
const frontmatter$5 = {
  "layout": "../../../layouts/global.astro",
  "title": "用 Markdown",
  "description": "Here is a sample of some basic Markdown syntax that can be used when writing Markdown content in Astro.",
  "published": "Jul 01 2022",
  "tags": ["guide"],
  "updated": "2024-03-14T07:17:37.514Z"
};
function getHeadings$5() {
  return [{
    "depth": 2,
    "slug": "paragraph",
    "text": "Paragraph"
  }, {
    "depth": 2,
    "slug": "images",
    "text": "Images"
  }, {
    "depth": 3,
    "slug": "syntax",
    "text": "Syntax"
  }, {
    "depth": 3,
    "slug": "output",
    "text": "Output"
  }, {
    "depth": 2,
    "slug": "blockquotes",
    "text": "Blockquotes"
  }, {
    "depth": 3,
    "slug": "blockquote-without-attribution",
    "text": "Blockquote without attribution"
  }, {
    "depth": 4,
    "slug": "syntax-1",
    "text": "Syntax"
  }, {
    "depth": 4,
    "slug": "output-1",
    "text": "Output"
  }, {
    "depth": 3,
    "slug": "blockquote-with-attribution",
    "text": "Blockquote with attribution"
  }, {
    "depth": 4,
    "slug": "syntax-2",
    "text": "Syntax"
  }, {
    "depth": 4,
    "slug": "output-2",
    "text": "Output"
  }, {
    "depth": 2,
    "slug": "tables",
    "text": "Tables"
  }, {
    "depth": 3,
    "slug": "syntax-3",
    "text": "Syntax"
  }, {
    "depth": 3,
    "slug": "output-3",
    "text": "Output"
  }, {
    "depth": 2,
    "slug": "code-blocks",
    "text": "Code Blocks"
  }, {
    "depth": 3,
    "slug": "syntax-4",
    "text": "Syntax"
  }, {
    "depth": 3,
    "slug": "output-4",
    "text": "Output"
  }, {
    "depth": 2,
    "slug": "list-types",
    "text": "List Types"
  }, {
    "depth": 3,
    "slug": "ordered-list",
    "text": "Ordered List"
  }, {
    "depth": 4,
    "slug": "syntax-5",
    "text": "Syntax"
  }, {
    "depth": 4,
    "slug": "output-5",
    "text": "Output"
  }, {
    "depth": 3,
    "slug": "unordered-list",
    "text": "Unordered List"
  }, {
    "depth": 4,
    "slug": "syntax-6",
    "text": "Syntax"
  }, {
    "depth": 4,
    "slug": "output-6",
    "text": "Output"
  }, {
    "depth": 3,
    "slug": "nested-list",
    "text": "Nested list"
  }, {
    "depth": 4,
    "slug": "syntax-7",
    "text": "Syntax"
  }, {
    "depth": 4,
    "slug": "output-7",
    "text": "Output"
  }, {
    "depth": 2,
    "slug": "other-elements--abbr-sub-sup-kbd-mark-del",
    "text": "Other Elements — abbr, sub, sup, kbd, mark, del"
  }, {
    "depth": 3,
    "slug": "syntax-8",
    "text": "Syntax"
  }, {
    "depth": 3,
    "slug": "output-8",
    "text": "Output"
  }, {
    "depth": 2,
    "slug": "footnote-label",
    "text": "Footnotes"
  }];
}
const __usesAstroImage$5 = true;
function _createMdxContent$5(props) {
  const _components = {
    a: "a",
    blockquote: "blockquote",
    code: "code",
    del: "del",
    em: "em",
    h2: "h2",
    h3: "h3",
    h4: "h4",
    hr: "hr",
    img: "img",
    li: "li",
    ol: "ol",
    p: "p",
    pre: "pre",
    section: "section",
    span: "span",
    strong: "strong",
    sup: "sup",
    table: "table",
    tbody: "tbody",
    td: "td",
    th: "th",
    thead: "thead",
    tr: "tr",
    ul: "ul",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.p, {
      children: "Here is a sample of some basic Markdown syntax that can be used when writing Markdown content in Astro."
    }), "\n", createVNode(_components.hr, {}), "\n", createVNode("section", {
      children: [createVNode(_components.h2, {
        id: "paragraph",
        children: "Paragraph"
      }), createVNode(_components.p, {
        children: "Xerum, quo qui aut unt expliquam qui dolut labo. Aque venitatiusda cum, voluptionse latur sitiae dolessi aut parist aut dollo enim qui voluptate ma dolestendit peritin re plis aut quas inctum laceat est volestemque commosa as cus endigna tectur, offic to cor sequas etum rerum idem sintibus eiur? Quianimin porecus evelectur, cum que nis nust voloribus ratem aut omnimi, sitatur? Quiatem. Nam, omnis sum am facea corem alique molestrunt et eos evelece arcillit ut aut eos eos nus, sin conecerem erum fuga. Ri oditatquam, ad quibus unda veliamenimin cusam et facea ipsamus es exerum sitate dolores editium rerore eost, temped molorro ratiae volorro te reribus dolorer sperchicium faceata tiustia prat."
      }), createVNode(_components.p, {
        children: "Itatur? Quiatae cullecum rem ent aut odis in re eossequodi nonsequ idebis ne sapicia is sinveli squiatum, core et que aut hariosam ex eat."
      })]
    }), "\n", createVNode("section", {
      children: [createVNode(_components.h2, {
        id: "images",
        children: "Images"
      }), createVNode("section", {
        children: [createVNode(_components.h3, {
          id: "syntax",
          children: "Syntax"
        }), createVNode(_components.pre, {
          class: "astro-code astro-code-themes github-light github-dark",
          style: {
            backgroundColor: "#fff",
            "--shiki-dark-bg": "#24292e",
            color: "#24292e",
            "--shiki-dark": "#e1e4e8",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word"
          },
          tabindex: "0",
          children: createVNode(_components.code, {
            children: [createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "!["
              }), createVNode(_components.span, {
                style: {
                  color: "#032F62",
                  "--shiki-dark": "#DBEDFF",
                  textDecoration: "underline",
                  "--shiki-dark-text-decoration": "underline"
                },
                children: "Alt text"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "]("
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8",
                  textDecoration: "underline",
                  "--shiki-dark-text-decoration": "underline"
                },
                children: "./full/or/relative/path/of/image"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ")"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line"
            })]
          })
        })]
      }), createVNode("section", {
        children: [createVNode(_components.h3, {
          id: "output",
          children: "Output"
        }), createVNode(_components.p, {
          children: createVNode(_components.img, {
            src: "/favicon.svg",
            alt: "favicon"
          })
        })]
      })]
    }), "\n", createVNode($$S, {
      children: [createVNode(_components.h2, {
        id: "blockquotes",
        children: "Blockquotes"
      }), createVNode(_components.p, {
        children: ["The blockquote element represents content that is quoted from another source, optionally with a citation which must be within a ", createVNode(_components.code, {
          children: "footer"
        }), " or ", createVNode(_components.code, {
          children: "cite"
        }), " element, and optionally with in-line changes such as annotations and abbreviations."]
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "blockquote-without-attribution",
          children: "Blockquote without attribution"
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "syntax-1",
            children: "Syntax"
          }), createVNode(_components.pre, {
            class: "astro-code astro-code-themes github-light github-dark",
            style: {
              backgroundColor: "#fff",
              "--shiki-dark-bg": "#24292e",
              color: "#24292e",
              "--shiki-dark": "#e1e4e8",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word"
            },
            tabindex: "0",
            children: createVNode(_components.code, {
              children: [createVNode(_components.span, {
                class: "line",
                children: createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "> Tiam, ad mint andaepu dandae nostion secatur sequo quae."
                })
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "> "
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8",
                    fontWeight: "bold",
                    "--shiki-dark-font-weight": "bold"
                  },
                  children: "**Note**"
                }), createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: " that you can use "
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8",
                    fontStyle: "italic",
                    "--shiki-dark-font-style": "italic"
                  },
                  children: "_Markdown syntax_"
                }), createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: " within a blockquote."
                })]
              }), "\n", createVNode(_components.span, {
                class: "line"
              })]
            })
          })]
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "output-1",
            children: "Output"
          }), createVNode(_components.blockquote, {
            children: ["\n", createVNode(_components.p, {
              children: ["Tiam, ad mint andaepu dandae nostion secatur sequo quae.\n", createVNode(_components.strong, {
                children: "Note"
              }), " that you can use ", createVNode(_components.em, {
                children: "Markdown syntax"
              }), " within a blockquote."]
            }), "\n"]
          })]
        })]
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "blockquote-with-attribution",
          children: "Blockquote with attribution"
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "syntax-2",
            children: "Syntax"
          }), createVNode(_components.pre, {
            class: "astro-code astro-code-themes github-light github-dark",
            style: {
              backgroundColor: "#fff",
              "--shiki-dark-bg": "#24292e",
              color: "#24292e",
              "--shiki-dark": "#e1e4e8",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word"
            },
            tabindex: "0",
            children: createVNode(_components.code, {
              children: [createVNode(_components.span, {
                class: "line",
                children: createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "> Don't communicate by sharing memory, share memory by communicating.<br>"
                })
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "> — <cite>Rob Pike["
                }), createVNode(_components.span, {
                  style: {
                    color: "#032F62",
                    "--shiki-dark": "#DBEDFF",
                    textDecoration: "underline",
                    "--shiki-dark-text-decoration": "underline"
                  },
                  children: "^1"
                }), createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "]</cite>"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line"
              })]
            })
          })]
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "output-2",
            children: "Output"
          }), createVNode(_components.blockquote, {
            children: ["\n", createVNode(_components.p, {
              children: "Don’t communicate by sharing memory, share memory by communicating."
            }), "\n", createVNode(_components.p, {
              children: ["— ", createVNode("cite", {
                children: ["Rob Pike", createVNode(_components.sup, {
                  children: createVNode(_components.a, {
                    href: "#user-content-fn-1",
                    id: "user-content-fnref-1",
                    "data-footnote-ref": "",
                    "aria-describedby": "footnote-label",
                    children: "1"
                  })
                })]
              })]
            }), "\n"]
          })]
        })]
      })]
    }), "\n", createVNode($$S, {
      children: [createVNode(_components.h2, {
        id: "tables",
        children: "Tables"
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "syntax-3",
          children: "Syntax"
        }), createVNode(_components.pre, {
          class: "astro-code astro-code-themes github-light github-dark",
          style: {
            backgroundColor: "#fff",
            "--shiki-dark-bg": "#24292e",
            color: "#24292e",
            "--shiki-dark": "#e1e4e8",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word"
          },
          tabindex: "0",
          children: createVNode(_components.code, {
            children: [createVNode(_components.span, {
              class: "line",
              children: createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "| Italics   | Bold     | Code   |"
              })
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "| --------- | -------- | ------ |"
              })
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "| "
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8",
                  fontStyle: "italic",
                  "--shiki-dark-font-style": "italic"
                },
                children: "_italics_"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: " | "
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8",
                  fontWeight: "bold",
                  "--shiki-dark-font-weight": "bold"
                },
                children: "**bold**"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: " | "
              }), createVNode(_components.span, {
                style: {
                  color: "#005CC5",
                  "--shiki-dark": "#79B8FF"
                },
                children: "`code`"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: " |"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line"
            })]
          })
        })]
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "output-3",
          children: "Output"
        }), "\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n", createVNode(_components.table, {
          children: [createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [createVNode(_components.th, {
                children: "Italics"
              }), createVNode(_components.th, {
                children: "Bold"
              }), createVNode(_components.th, {
                children: "Code"
              })]
            })
          }), createVNode(_components.tbody, {
            children: [createVNode(_components.tr, {
              children: [createVNode(_components.td, {
                children: createVNode(_components.em, {
                  children: "italics"
                })
              }), createVNode(_components.td, {
                children: createVNode(_components.strong, {
                  children: "bold"
                })
              }), createVNode(_components.td, {
                children: createVNode(_components.code, {
                  children: "code"
                })
              })]
            }), createVNode(_components.tr, {
              children: [createVNode(_components.td, {
                children: createVNode(_components.em, {
                  children: "italics"
                })
              }), createVNode(_components.td, {
                children: createVNode(_components.strong, {
                  children: "bold"
                })
              }), createVNode(_components.td, {
                children: createVNode(_components.code, {
                  children: "code"
                })
              })]
            })]
          })]
        })]
      })]
    }), "\n", createVNode($$S, {
      children: [createVNode(_components.h2, {
        id: "code-blocks",
        children: "Code Blocks"
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "syntax-4",
          children: "Syntax"
        }), createVNode(_components.p, {
          children: "we can use 3 backticks ``` in new line and write snippet and close with 3 backticks on new line and to highlight language specific syntac, write one word of language name after first 3 backticks, for eg. html, javascript, css, markdown, typescript, txt, bash"
        }), createVNode(_components.pre, {
          class: "astro-code astro-code-themes github-light github-dark",
          style: {
            backgroundColor: "#fff",
            "--shiki-dark-bg": "#24292e",
            color: "#24292e",
            "--shiki-dark": "#e1e4e8",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word"
          },
          tabindex: "0",
          children: createVNode(_components.code, {
            children: [createVNode(_components.span, {
              class: "line",
              children: createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "```html"
              })
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "<!"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "doctype"
              }), createVNode(_components.span, {
                style: {
                  color: "#6F42C1",
                  "--shiki-dark": "#B392F0"
                },
                children: " html"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "<"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "html"
              }), createVNode(_components.span, {
                style: {
                  color: "#6F42C1",
                  "--shiki-dark": "#B392F0"
                },
                children: " lang"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "="
              }), createVNode(_components.span, {
                style: {
                  color: "#032F62",
                  "--shiki-dark": "#9ECBFF"
                },
                children: '"en"'
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "  <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "head"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "    <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "meta"
              }), createVNode(_components.span, {
                style: {
                  color: "#6F42C1",
                  "--shiki-dark": "#B392F0"
                },
                children: " charset"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "="
              }), createVNode(_components.span, {
                style: {
                  color: "#032F62",
                  "--shiki-dark": "#9ECBFF"
                },
                children: '"utf-8"'
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: " />"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "    <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "title"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">Example HTML5 Document</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "title"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "  </"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "head"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "  <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "body"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "    <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "p"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">Test</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "p"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "  </"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "body"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "html"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "```"
              })
            }), "\n", createVNode(_components.span, {
              class: "line"
            })]
          })
        })]
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "output-4",
          children: "Output"
        }), createVNode(_components.pre, {
          class: "astro-code astro-code-themes github-light github-dark",
          style: {
            backgroundColor: "#fff",
            "--shiki-dark-bg": "#24292e",
            color: "#24292e",
            "--shiki-dark": "#e1e4e8",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word"
          },
          tabindex: "0",
          children: createVNode(_components.code, {
            children: [createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "<!"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "doctype"
              }), createVNode(_components.span, {
                style: {
                  color: "#6F42C1",
                  "--shiki-dark": "#B392F0"
                },
                children: " html"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "<"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "html"
              }), createVNode(_components.span, {
                style: {
                  color: "#6F42C1",
                  "--shiki-dark": "#B392F0"
                },
                children: " lang"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "="
              }), createVNode(_components.span, {
                style: {
                  color: "#032F62",
                  "--shiki-dark": "#9ECBFF"
                },
                children: '"en"'
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "  <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "head"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "    <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "meta"
              }), createVNode(_components.span, {
                style: {
                  color: "#6F42C1",
                  "--shiki-dark": "#B392F0"
                },
                children: " charset"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "="
              }), createVNode(_components.span, {
                style: {
                  color: "#032F62",
                  "--shiki-dark": "#9ECBFF"
                },
                children: '"utf-8"'
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: " />"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "    <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "title"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">Example HTML5 Document</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "title"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "  </"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "head"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "  <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "body"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "    <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "p"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">Test</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "p"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "  </"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "body"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "html"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line"
            })]
          })
        })]
      })]
    }), "\n", createVNode($$S, {
      children: [createVNode(_components.h2, {
        id: "list-types",
        children: "List Types"
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "ordered-list",
          children: "Ordered List"
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "syntax-5",
            children: "Syntax"
          }), createVNode(_components.pre, {
            class: "astro-code astro-code-themes github-light github-dark",
            style: {
              backgroundColor: "#fff",
              "--shiki-dark-bg": "#24292e",
              color: "#24292e",
              "--shiki-dark": "#e1e4e8",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word"
            },
            tabindex: "0",
            children: createVNode(_components.code, {
              children: [createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "1."
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " First item"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "2."
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " Second item"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "3."
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " Third item"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line"
              })]
            })
          })]
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "output-5",
            children: "Output"
          }), createVNode(_components.ol, {
            children: ["\n", createVNode(_components.li, {
              children: "First item"
            }), "\n", createVNode(_components.li, {
              children: "Second item"
            }), "\n", createVNode(_components.li, {
              children: "Third item"
            }), "\n"]
          })]
        })]
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "unordered-list",
          children: "Unordered List"
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "syntax-6",
            children: "Syntax"
          }), createVNode(_components.pre, {
            class: "astro-code astro-code-themes github-light github-dark",
            style: {
              backgroundColor: "#fff",
              "--shiki-dark-bg": "#24292e",
              color: "#24292e",
              "--shiki-dark": "#e1e4e8",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word"
            },
            tabindex: "0",
            children: createVNode(_components.code, {
              children: [createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "-"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " List item"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "-"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " Another item"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "-"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " And another item"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line"
              })]
            })
          })]
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "output-6",
            children: "Output"
          }), createVNode(_components.ul, {
            children: ["\n", createVNode(_components.li, {
              children: "List item"
            }), "\n", createVNode(_components.li, {
              children: "Another item"
            }), "\n", createVNode(_components.li, {
              children: "And another item"
            }), "\n"]
          })]
        })]
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "nested-list",
          children: "Nested list"
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "syntax-7",
            children: "Syntax"
          }), createVNode(_components.pre, {
            class: "astro-code astro-code-themes github-light github-dark",
            style: {
              backgroundColor: "#fff",
              "--shiki-dark-bg": "#24292e",
              color: "#24292e",
              "--shiki-dark": "#e1e4e8",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word"
            },
            tabindex: "0",
            children: createVNode(_components.code, {
              children: [createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "-"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " <"
                }), createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "p"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: ">Fruit</"
                }), createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "p"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: ">"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "  -"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " Apple"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "  -"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " Orange"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "  -"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " Banana"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "-"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " <"
                }), createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "p"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: ">Dairy</"
                }), createVNode(_components.span, {
                  style: {
                    color: "#22863A",
                    "--shiki-dark": "#85E89D"
                  },
                  children: "p"
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: ">"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "  1."
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " Milk"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line",
                children: [createVNode(_components.span, {
                  style: {
                    color: "#E36209",
                    "--shiki-dark": "#FFAB70"
                  },
                  children: "  2."
                }), createVNode(_components.span, {
                  style: {
                    color: "#24292E",
                    "--shiki-dark": "#E1E4E8"
                  },
                  children: " Cheese"
                })]
              }), "\n", createVNode(_components.span, {
                class: "line"
              })]
            })
          })]
        }), createVNode($$S, {
          children: [createVNode(_components.h4, {
            id: "output-7",
            children: "Output"
          }), createVNode(_components.ul, {
            children: ["\n", createVNode(_components.li, {
              children: ["\n", createVNode("p", {
                children: "Fruit"
              }), "\n", createVNode(_components.ul, {
                children: ["\n", createVNode(_components.li, {
                  children: "Apple"
                }), "\n", createVNode(_components.li, {
                  children: "Orange"
                }), "\n", createVNode(_components.li, {
                  children: "Banana"
                }), "\n"]
              }), "\n"]
            }), "\n", createVNode(_components.li, {
              children: ["\n", createVNode("p", {
                children: "Dairy"
              }), "\n", createVNode(_components.ol, {
                children: ["\n", createVNode(_components.li, {
                  children: "Milk"
                }), "\n", createVNode(_components.li, {
                  children: "Cheese"
                }), "\n"]
              }), "\n"]
            }), "\n"]
          })]
        })]
      })]
    }), "\n", createVNode($$S, {
      children: [createVNode(_components.h2, {
        id: "other-elements--abbr-sub-sup-kbd-mark-del",
        children: "Other Elements — abbr, sub, sup, kbd, mark, del"
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "syntax-8",
          children: "Syntax"
        }), createVNode(_components.pre, {
          class: "astro-code astro-code-themes github-light github-dark",
          style: {
            backgroundColor: "#fff",
            "--shiki-dark-bg": "#24292e",
            color: "#24292e",
            "--shiki-dark": "#e1e4e8",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word"
          },
          tabindex: "0",
          children: createVNode(_components.code, {
            children: [createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "<"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "abbr"
              }), createVNode(_components.span, {
                style: {
                  color: "#6F42C1",
                  "--shiki-dark": "#B392F0"
                },
                children: " title"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "="
              }), createVNode(_components.span, {
                style: {
                  color: "#032F62",
                  "--shiki-dark": "#9ECBFF"
                },
                children: '"Graphics Interchange Format"'
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">GIF</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "abbr"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "> is a bitmap image format."
              })]
            }), "\n", createVNode(_components.span, {
              class: "line"
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "H<"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "sub"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">2</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "sub"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">O"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line"
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "X<"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "sup"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">n</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "sup"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "> + Y<"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "sup"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">n</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "sup"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "> = Z<"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "sup"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">n</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "sup"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">"
              })]
            }), "\n", createVNode(_components.span, {
              class: "line"
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "Press <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "kbd"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">CTRL</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "kbd"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "> + <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "kbd"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">ALT</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "kbd"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "> + <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "kbd"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">Delete</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "kbd"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "> to end the session."
              })]
            }), "\n", createVNode(_components.span, {
              class: "line"
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: [createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "Most <"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "mark"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: ">salamanders</"
              }), createVNode(_components.span, {
                style: {
                  color: "#22863A",
                  "--shiki-dark": "#85E89D"
                },
                children: "mark"
              }), createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "> are nocturnal, and hunt for insects, worms, and other small creatures."
              })]
            }), "\n", createVNode(_components.span, {
              class: "line"
            }), "\n", createVNode(_components.span, {
              class: "line",
              children: createVNode(_components.span, {
                style: {
                  color: "#24292E",
                  "--shiki-dark": "#E1E4E8"
                },
                children: "~strikethrough~"
              })
            }), "\n", createVNode(_components.span, {
              class: "line"
            })]
          })
        })]
      }), createVNode($$S, {
        children: [createVNode(_components.h3, {
          id: "output-8",
          children: "Output"
        }), createVNode(_components.p, {
          children: [createVNode("abbr", {
            title: "Graphics Interchange Format",
            children: "GIF"
          }), " is a bitmap image format."]
        }), createVNode(_components.p, {
          children: ["H", createVNode("sub", {
            children: "2"
          }), "O"]
        }), createVNode(_components.p, {
          children: ["X", createVNode("sup", {
            children: "n"
          }), " + Y", createVNode("sup", {
            children: "n"
          }), " = Z", createVNode("sup", {
            children: "n"
          })]
        }), createVNode(_components.p, {
          children: ["Press ", createVNode("kbd", {
            children: "CTRL"
          }), " + ", createVNode("kbd", {
            children: "ALT"
          }), " + ", createVNode("kbd", {
            children: "Delete"
          }), " to end the session."]
        }), createVNode(_components.p, {
          children: ["Most ", createVNode("mark", {
            children: "salamanders"
          }), " are nocturnal, and hunt for insects, worms, and other small creatures."]
        }), createVNode(_components.p, {
          children: createVNode(_components.del, {
            children: "strikethrough"
          })
        })]
      })]
    }), "\n", "\n", createVNode(_components.section, {
      "data-footnotes": "",
      class: "footnotes",
      children: [createVNode(_components.h2, {
        class: "sr-only",
        id: "footnote-label",
        children: "Footnotes"
      }), "\n", createVNode(_components.ol, {
        children: ["\n", createVNode(_components.li, {
          id: "user-content-fn-1",
          children: ["\n", createVNode(_components.p, {
            children: ["The above quote is excerpted from Rob Pike’s ", createVNode(_components.a, {
              href: "https://www.youtube.com/watch?v=PAAkCSZUG1c",
              children: "talk"
            }), " during Gopherfest, November 18, 2015. ", createVNode(_components.a, {
              href: "#user-content-fnref-1",
              "data-footnote-backref": "",
              "aria-label": "Back to reference 1",
              class: "data-footnote-backref",
              children: "↩"
            })]
          }), "\n"]
        }), "\n"]
      }), "\n"]
    })]
  });
}
function MDXContent$5(props = {}) {
  return createVNode(MDXLayout$5, {
    ...props,
    children: createVNode(_createMdxContent$5, {
      ...props
    })
  });
}
__astro_tag_component__(getHeadings$5, "astro:jsx");
__astro_tag_component__(MDXContent$5, "astro:jsx");
const url$5 = "/subtle/zh/post/markdown-style-guide";
const file$5 = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/zh/post/markdown-style-guide.mdx";
const Content$5 = (props = {}) => MDXContent$5({
  ...props,
  components: { Fragment, ...props.components, "astro-image": props.components?.img ?? $$Image }
});
Content$5[Symbol.for("mdx-component")] = true;
Content$5[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter$5.layout);
Content$5.moduleId = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/zh/post/markdown-style-guide.mdx";
const __vite_glob_0_6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Content: Content$5,
  __usesAstroImage: __usesAstroImage$5,
  default: Content$5,
  file: file$5,
  frontmatter: frontmatter$5,
  getHeadings: getHeadings$5,
  url: url$5
}, Symbol.toStringTag, { value: "Module" }));
const MDXLayout$4 = async function({
  children
}) {
  const Layout = (await import("./global_DvQrrc-O.mjs")).default;
  const {
    layout,
    ...content
  } = frontmatter$4;
  content.file = file$4;
  content.url = url$4;
  return createVNode(Layout, {
    file: file$4,
    url: url$4,
    content,
    frontmatter: content,
    headings: getHeadings$4(),
    "server:root": true,
    children
  });
};
const frontmatter$4 = {
  "layout": "../../../layouts/global.astro",
  "title": "第二篇",
  "description": "Lorem ipsum dolor sit amet",
  "published": "Jul 15 2022",
  "tags": ["example"],
  "updated": "2024-03-14T07:17:13.237Z"
};
function getHeadings$4() {
  return [];
}
const __usesAstroImage$4 = true;
function _createMdxContent$4(props) {
  const _components = {
    p: "p",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.p, {
      children: "Morbi tristique senectus et netus. Id semper risus in hendrerit gravida rutrum quisque non tellus. Habitasse platea dictumst quisque sagittis purus sit amet. Tellus molestie nunc non blandit massa. Cursus vitae congue mauris rhoncus. Accumsan tortor posuere ac ut. Fringilla urna porttitor rhoncus dolor. Elit ullamcorper dignissim cras tincidunt lobortis. In cursus turpis massa tincidunt dui ut ornare lectus. Integer feugiat scelerisque varius morbi enim nunc. Bibendum neque egestas congue quisque egestas diam. Cras ornare arcu dui vivamus arcu felis bibendum. Dignissim suspendisse in est ante in nibh mauris. Sed tempus urna et pharetra pharetra massa massa ultricies mi."
    }), "\n", createVNode(_components.p, {
      children: "Mollis nunc sed id semper risus in. Convallis a cras semper auctor neque. Diam sit amet nisl suscipit. Lacus viverra vitae congue eu consequat ac felis donec. Egestas integer eget aliquet nibh praesent tristique magna sit amet. Eget magna fermentum iaculis eu non diam. In vitae turpis massa sed elementum. Tristique et egestas quis ipsum suspendisse ultrices. Eget lorem dolor sed viverra ipsum. Vel turpis nunc eget lorem dolor sed viverra. Posuere ac ut consequat semper viverra nam. Laoreet suspendisse interdum consectetur libero id faucibus. Diam phasellus vestibulum lorem sed risus ultricies tristique. Rhoncus dolor purus non enim praesent elementum facilisis. Ultrices tincidunt arcu non sodales neque. Tempus egestas sed sed risus pretium quam vulputate. Viverra suspendisse potenti nullam ac tortor vitae purus faucibus ornare. Fringilla urna porttitor rhoncus dolor purus non. Amet dictum sit amet justo donec enim."
    }), "\n", createVNode(_components.p, {
      children: "Mattis ullamcorper velit sed ullamcorper morbi tincidunt. Tortor posuere ac ut consequat semper viverra. Tellus mauris a diam maecenas sed enim ut sem viverra. Venenatis urna cursus eget nunc scelerisque viverra mauris in. Arcu ac tortor dignissim convallis aenean et tortor at. Curabitur gravida arcu ac tortor dignissim convallis aenean et tortor. Egestas tellus rutrum tellus pellentesque eu. Fusce ut placerat orci nulla pellentesque dignissim enim sit amet. Ut enim blandit volutpat maecenas volutpat blandit aliquam etiam. Id donec ultrices tincidunt arcu. Id cursus metus aliquam eleifend mi."
    }), "\n", createVNode(_components.p, {
      children: "Tempus quam pellentesque nec nam aliquam sem. Risus at ultrices mi tempus imperdiet. Id porta nibh venenatis cras sed felis eget velit. Ipsum a arcu cursus vitae. Facilisis magna etiam tempor orci eu lobortis elementum. Tincidunt dui ut ornare lectus sit. Quisque non tellus orci ac. Blandit libero volutpat sed cras. Nec tincidunt praesent semper feugiat nibh sed pulvinar proin gravida. Egestas integer eget aliquet nibh praesent tristique magna."
    })]
  });
}
function MDXContent$4(props = {}) {
  return createVNode(MDXLayout$4, {
    ...props,
    children: createVNode(_createMdxContent$4, {
      ...props
    })
  });
}
__astro_tag_component__(getHeadings$4, "astro:jsx");
__astro_tag_component__(MDXContent$4, "astro:jsx");
const url$4 = "/subtle/zh/post/second-post";
const file$4 = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/zh/post/second-post.mdx";
const Content$4 = (props = {}) => MDXContent$4({
  ...props,
  components: { Fragment, ...props.components, "astro-image": props.components?.img ?? $$Image }
});
Content$4[Symbol.for("mdx-component")] = true;
Content$4[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter$4.layout);
Content$4.moduleId = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/zh/post/second-post.mdx";
const __vite_glob_0_7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Content: Content$4,
  __usesAstroImage: __usesAstroImage$4,
  default: Content$4,
  file: file$4,
  frontmatter: frontmatter$4,
  getHeadings: getHeadings$4,
  url: url$4
}, Symbol.toStringTag, { value: "Module" }));
const MDXLayout$3 = async function({
  children
}) {
  const Layout = (await import("./global_DvQrrc-O.mjs")).default;
  const {
    layout,
    ...content
  } = frontmatter$3;
  content.file = file$3;
  content.url = url$3;
  return createVNode(Layout, {
    file: file$3,
    url: url$3,
    content,
    frontmatter: content,
    headings: getHeadings$3(),
    "server:root": true,
    children
  });
};
const frontmatter$3 = {
  "layout": "../../../layouts/global.astro",
  "title": "用 MDX",
  "description": "Lorem ipsum dolor sit amet",
  "published": "Jul 02 2022",
  "tags": ["example", "guide"],
  "updated": "2024-03-14T07:17:13.237Z"
};
function getHeadings$3() {
  return [];
}
const __usesAstroImage$3 = true;
function _createMdxContent$3(props) {
  const _components = {
    p: "p",
    ...props.components
  };
  return createVNode(_components.p, {
    children: "用 MDX"
  });
}
function MDXContent$3(props = {}) {
  return createVNode(MDXLayout$3, {
    ...props,
    children: createVNode(_createMdxContent$3, {
      ...props
    })
  });
}
__astro_tag_component__(getHeadings$3, "astro:jsx");
__astro_tag_component__(MDXContent$3, "astro:jsx");
const url$3 = "/subtle/zh/post/using-mdx";
const file$3 = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/zh/post/using-mdx.mdx";
const Content$3 = (props = {}) => MDXContent$3({
  ...props,
  components: { Fragment, ...props.components, "astro-image": props.components?.img ?? $$Image }
});
Content$3[Symbol.for("mdx-component")] = true;
Content$3[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter$3.layout);
Content$3.moduleId = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/zh/post/using-mdx.mdx";
const __vite_glob_0_8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Content: Content$3,
  __usesAstroImage: __usesAstroImage$3,
  default: Content$3,
  file: file$3,
  frontmatter: frontmatter$3,
  getHeadings: getHeadings$3,
  url: url$3
}, Symbol.toStringTag, { value: "Module" }));
const TITLE = "Subtle";
const DESCRIPTION = "Personal Blog Theme for Astro";
const COLOR = "#966783";
const AUTHOR = "Aquaticat";
const SOCIALS = Object.freeze(
  /* @__PURE__ */ new Map([
    ["RSS Feed", "https://aquati.cat/rss"],
    ["Email", "mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle"],
    ["GitHub", "https://github.com/Aquaticat"],
    ["Telegram", "https://t.me/Aquaticat"]
  ])
);
const LINKS = Object.freeze(
  /* @__PURE__ */ new Map([
    ["Catoverflow", "https://c-j.dev"],
    ["dummy1", "https://example.com"],
    ["big dummy2", "https://example.com"],
    ["big big dummy1", "https://example.com"],
    ["big big dummy2", "https://example.com"],
    ["dummy3", "https://example.com"],
    ["dummy4", "https://example.com"],
    ["dummy5", "https://example.com"],
    ["dummy6", "https://example.com"]
  ])
);
const langMappings = Object.freeze([
  { codes: ["en", "en-US", "en-CA", "en-UK", "en-GB"], path: "" },
  { codes: ["zh", "zh-CN", "zh-TW"], path: "zh" }
]);
Object.freeze(
  new Map(langMappings.flatMap((langMapping) => langMapping.codes.map((key) => [key, langMapping.path])))
);
const LANG_PATHS = Object.freeze(langMappings.map((langMapping) => langMapping.path));
const STRINGS = Object.freeze(
  /* @__PURE__ */ new Map([
    [
      "404",
      /* @__PURE__ */ new Map([
        ["en", `You've landed on an unknown page.`],
        ["zh", "未知领域"]
      ])
    ],
    [
      "tempUnavailable",
      /* @__PURE__ */ new Map([
        ["en", "Sorry, this page is not available in your language yet. Please check back later."],
        ["zh", "抱歉，此页暂时无所选语言的版本，请稍后再看。"]
      ])
    ],
    [
      "unsupported",
      /* @__PURE__ */ new Map([
        ["en", "Sorry, this site is not available in your language."],
        ["zh", "抱歉，此网站不支持所选语言。"]
      ])
    ],
    [
      "searchPlaceholder",
      /* @__PURE__ */ new Map([
        ["en", "Search tags, topics, or snippets"],
        ["zh", "搜索关键词，话题，或文段"]
      ])
    ]
  ])
);
const DEFAULT_LANG = langMappings.find((langMapping) => langMapping.path === "").codes[0];
Object.freeze(LANG_PATHS.toSpliced(LANG_PATHS.indexOf(""), 1, DEFAULT_LANG));
async function GET(context) {
  const posts = Object.values(/* @__PURE__ */ Object.assign({ "./post/first-post.mdx": __vite_glob_0_0, "./post/markdown-style-guide.mdx": __vite_glob_0_1, "./post/second-post.mdx": __vite_glob_0_2, "./post/third-post.mdx": __vite_glob_0_3, "./post/using-mdx.mdx": __vite_glob_0_4, "./zh/post/first-post.mdx": __vite_glob_0_5, "./zh/post/markdown-style-guide.mdx": __vite_glob_0_6, "./zh/post/second-post.mdx": __vite_glob_0_7, "./zh/post/using-mdx.mdx": __vite_glob_0_8 }));
  return rss({
    title: TITLE,
    description: DESCRIPTION,
    site: context.site,
    items: posts.map((post) => ({
      link: post.url,
      title: post.frontmattertitle,
      description: post.frontmatter.description,
      pubDate: post.frontmatter.published
    }))
  });
}
const rss_xml = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: "Module" }));
const MDXLayout$2 = async function({
  children
}) {
  const Layout = (await import("./global_DvQrrc-O.mjs")).default;
  const {
    layout,
    ...content
  } = frontmatter$2;
  content.file = file$2;
  content.url = url$2;
  return createVNode(Layout, {
    file: file$2,
    url: url$2,
    content,
    frontmatter: content,
    headings: getHeadings$2(),
    "server:root": true,
    children
  });
};
const frontmatter$2 = {
  "layout": "../../layouts/global.astro",
  "title": "Links",
  "published": "2024MAR07",
  "updated": "2024-03-14T07:33:17.027Z"
};
function getHeadings$2() {
  return [];
}
const __usesAstroImage$2 = true;
function _createMdxContent$2(props) {
  const _components = {
    p: "p",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.p, {
      children: "朋友们。"
    }), "\n", createVNode(_components.p, {
      children: "或者建议我做这个项目或者帮我做这个项目的。"
    })]
  });
}
function MDXContent$2(props = {}) {
  return createVNode(MDXLayout$2, {
    ...props,
    children: createVNode(_createMdxContent$2, {
      ...props
    })
  });
}
__astro_tag_component__(getHeadings$2, "astro:jsx");
__astro_tag_component__(MDXContent$2, "astro:jsx");
const url$2 = "/subtle/zh/links";
const file$2 = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/zh/links.mdx";
const Content$2 = (props = {}) => MDXContent$2({
  ...props,
  components: { Fragment, ...props.components, "astro-image": props.components?.img ?? $$Image }
});
Content$2[Symbol.for("mdx-component")] = true;
Content$2[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter$2.layout);
Content$2.moduleId = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/zh/links.mdx";
const links = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Content: Content$2,
  __usesAstroImage: __usesAstroImage$2,
  default: Content$2,
  file: file$2,
  frontmatter: frontmatter$2,
  getHeadings: getHeadings$2,
  url: url$2
}, Symbol.toStringTag, { value: "Module" }));
const MDXLayout$1 = async function({
  children
}) {
  const Layout = (await import("./global_DvQrrc-O.mjs")).default;
  const {
    layout,
    ...content
  } = frontmatter$1;
  content.file = file$1;
  content.url = url$1;
  return createVNode(Layout, {
    file: file$1,
    url: url$1,
    content,
    frontmatter: content,
    headings: getHeadings$1(),
    "server:root": true,
    children
  });
};
const frontmatter$1 = {
  "layout": "../../layouts/global.astro",
  "title": "Subtle",
  "published": "2024MAR07",
  "updated": "2024-03-14T07:13:27.822Z"
};
function getHeadings$1() {
  return [];
}
const __usesAstroImage$1 = true;
function _createMdxContent$1(props) {
  const _components = {
    li: "li",
    ol: "ol",
    p: "p",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.p, {
      children: "不幸的是，我没能找到对于个人博客来说刚刚好的静态页面生成器主题。"
    }), "\n", createVNode(_components.p, {
      children: "需求只是有个地方放东西。"
    }), "\n", createVNode("section", {
      children: [createVNode(_components.p, {
        children: "不需要："
      }), createVNode(_components.ol, {
        children: ["\n", createVNode(_components.li, {
          children: ["\n", createVNode(_components.p, {
            children: "页面套页面 — 那对于文档站更适用。"
          }), "\n"]
        }), "\n", createVNode(_components.li, {
          children: ["\n", createVNode(_components.p, {
            children: "炫酷 — 又不是在卖东西"
          }), "\n"]
        }), "\n", createVNode(_components.li, {
          children: ["\n", createVNode(_components.p, {
            children: "硬需求 JS — 有人关掉"
          }), "\n"]
        }), "\n", createVNode(_components.li, {
          children: ["\n", createVNode(_components.p, {
            children: "非系统字体 — 挺好，但是没必要\n未来可以加上它这个选项。"
          }), "\n"]
        }), "\n"]
      })]
    })]
  });
}
function MDXContent$1(props = {}) {
  return createVNode(MDXLayout$1, {
    ...props,
    children: createVNode(_createMdxContent$1, {
      ...props
    })
  });
}
__astro_tag_component__(getHeadings$1, "astro:jsx");
__astro_tag_component__(MDXContent$1, "astro:jsx");
const url$1 = "/subtle/zh";
const file$1 = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/zh/index.mdx";
const Content$1 = (props = {}) => MDXContent$1({
  ...props,
  components: { Fragment, ...props.components, "astro-image": props.components?.img ?? $$Image }
});
Content$1[Symbol.for("mdx-component")] = true;
Content$1[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter$1.layout);
Content$1.moduleId = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/zh/index.mdx";
const index$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Content: Content$1,
  __usesAstroImage: __usesAstroImage$1,
  default: Content$1,
  file: file$1,
  frontmatter: frontmatter$1,
  getHeadings: getHeadings$1,
  url: url$1
}, Symbol.toStringTag, { value: "Module" }));
const MDXLayout = async function({
  children
}) {
  const Layout = (await import("./global_DvQrrc-O.mjs")).default;
  const {
    layout,
    ...content
  } = frontmatter;
  content.file = file;
  content.url = url;
  return createVNode(Layout, {
    file,
    url,
    content,
    frontmatter: content,
    headings: getHeadings(),
    "server:root": true,
    children
  });
};
const frontmatter = {
  "layout": "../layouts/global.astro",
  "title": "Subtle",
  "published": "2024MAR07",
  "updated": "2024-03-08T09:32:26.292Z"
};
function getHeadings() {
  return [];
}
const __usesAstroImage = true;
function _createMdxContent(props) {
  const _components = {
    li: "li",
    ol: "ol",
    p: "p",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.p, {
      children: "Unfortunately, I wasn’t able to find just-enough themes or static site generators for a personal blog."
    }), "\n", createVNode(_components.p, {
      children: "What we need is just a place to post random stuff."
    }), "\n", createVNode("section", {
      children: [createVNode(_components.p, {
        children: "What we don’t need is:"
      }), createVNode(_components.ol, {
        children: ["\n", createVNode(_components.li, {
          children: ["\n", createVNode(_components.p, {
            children: "Multi-layered file structures - That’s more for a documentation site."
          }), "\n"]
        }), "\n", createVNode(_components.li, {
          children: ["\n", createVNode(_components.p, {
            children: "Flashy effects - That’s more for selling a product."
          }), "\n"]
        }), "\n", createVNode(_components.li, {
          children: ["\n", createVNode(_components.p, {
            children: "Dependency on JS - Some people disable JS."
          }), "\n"]
        }), "\n", createVNode(_components.li, {
          children: ["\n", createVNode(_components.p, {
            children: "Custom fonts - Could be nice, but not absolutely necessary for a personal blog.\nCould add that as an option."
          }), "\n"]
        }), "\n"]
      })]
    })]
  });
}
function MDXContent(props = {}) {
  return createVNode(MDXLayout, {
    ...props,
    children: createVNode(_createMdxContent, {
      ...props
    })
  });
}
__astro_tag_component__(getHeadings, "astro:jsx");
__astro_tag_component__(MDXContent, "astro:jsx");
const url = "/subtle";
const file = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/index.mdx";
const Content = (props = {}) => MDXContent({
  ...props,
  components: { Fragment, ...props.components, "astro-image": props.components?.img ?? $$Image }
});
Content[Symbol.for("mdx-component")] = true;
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout);
Content.moduleId = "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/pages/index.mdx";
const index = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Content,
  __usesAstroImage,
  default: Content,
  file,
  frontmatter,
  getHeadings,
  url
}, Symbol.toStringTag, { value: "Module" }));
export {
  AUTHOR as A,
  COLOR as C,
  DESCRIPTION as D,
  LINKS as L,
  STRINGS as S,
  TITLE as T,
  _404 as _,
  DEFAULT_LANG as a,
  SOCIALS as b,
  __vite_glob_0_0 as c,
  __vite_glob_0_1 as d,
  __vite_glob_0_2 as e,
  __vite_glob_0_3 as f,
  __vite_glob_0_4 as g,
  __vite_glob_0_5 as h,
  __vite_glob_0_6 as i,
  __vite_glob_0_7 as j,
  __vite_glob_0_8 as k,
  links$1 as l,
  links as m,
  index$1 as n,
  index as o,
  rss_xml as r
};
