(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node2 of mutation.addedNodes) {
        if (node2.tagName === "LINK" && node2.rel === "modulepreload")
          processPreload(node2);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
function toFilter(filter) {
  if (typeof filter === "function") return filter;
  return getLevelFilter(filter);
}
function getLevelFilter(level) {
  if (level == null) return () => false;
  if (level === "fatal") {
    return (record) => record.level === "fatal";
  } else if (level === "error") {
    return (record) => record.level === "fatal" || record.level === "error";
  } else if (level === "warning") {
    return (record) => record.level === "fatal" || record.level === "error" || record.level === "warning";
  } else if (level === "info") {
    return (record) => record.level === "fatal" || record.level === "error" || record.level === "warning" || record.level === "info";
  } else if (level === "debug") return () => true;
  throw new TypeError(`Invalid log level: ${level}.`);
}
const logLevels = [
  "debug",
  "info",
  "warning",
  "error",
  "fatal"
];
function compareLogLevel(a, b) {
  const aIndex = logLevels.indexOf(a);
  if (aIndex < 0) {
    throw new TypeError(`Invalid log level: ${JSON.stringify(a)}.`);
  }
  const bIndex = logLevels.indexOf(b);
  if (bIndex < 0) {
    throw new TypeError(`Invalid log level: ${JSON.stringify(b)}.`);
  }
  return aIndex - bIndex;
}
function getLogger(category = []) {
  return LoggerImpl.getLogger(category);
}
const globalRootLoggerSymbol = Symbol.for("logtape.rootLogger");
class LoggerImpl {
  parent;
  children;
  category;
  sinks;
  parentSinks = "inherit";
  filters;
  lowestLevel = "debug";
  contextLocalStorage;
  static getLogger(category = []) {
    let rootLogger = globalRootLoggerSymbol in globalThis ? globalThis[globalRootLoggerSymbol] ?? null : null;
    if (rootLogger == null) {
      rootLogger = new LoggerImpl(null, []);
      globalThis[globalRootLoggerSymbol] = rootLogger;
    }
    if (typeof category === "string") return rootLogger.getChild(category);
    if (category.length === 0) return rootLogger;
    return rootLogger.getChild(category);
  }
  constructor(parent2, category) {
    this.parent = parent2;
    this.children = {};
    this.category = category;
    this.sinks = [];
    this.filters = [];
  }
  getChild(subcategory) {
    const name = typeof subcategory === "string" ? subcategory : subcategory[0];
    const childRef = this.children[name];
    let child = childRef instanceof LoggerImpl ? childRef : childRef?.deref();
    if (child == null) {
      child = new LoggerImpl(this, [
        ...this.category,
        name
      ]);
      this.children[name] = "WeakRef" in globalThis ? new WeakRef(child) : child;
    }
    if (typeof subcategory === "string" || subcategory.length === 1) {
      return child;
    }
    return child.getChild(subcategory.slice(1));
  }
  /**
   * Reset the logger.  This removes all sinks and filters from the logger.
   */
  reset() {
    while (this.sinks.length > 0) this.sinks.shift();
    this.parentSinks = "inherit";
    while (this.filters.length > 0) this.filters.shift();
    this.lowestLevel = "debug";
  }
  /**
   * Reset the logger and all its descendants.  This removes all sinks and
   * filters from the logger and all its descendants.
   */
  resetDescendants() {
    for (const child of Object.values(this.children)) {
      const logger = child instanceof LoggerImpl ? child : child.deref();
      if (logger != null) logger.resetDescendants();
    }
    this.reset();
  }
  with(properties) {
    return new LoggerCtx(this, {
      ...properties
    });
  }
  filter(record) {
    for (const filter of this.filters) {
      if (!filter(record)) return false;
    }
    if (this.filters.length < 1) return this.parent?.filter(record) ?? true;
    return true;
  }
  *getSinks(level) {
    if (this.lowestLevel === null || compareLogLevel(level, this.lowestLevel) < 0) {
      return;
    }
    if (this.parent != null && this.parentSinks === "inherit") {
      for (const sink of this.parent.getSinks(level)) yield sink;
    }
    for (const sink of this.sinks) yield sink;
  }
  emit(record, bypassSinks) {
    if (this.lowestLevel === null || compareLogLevel(record.level, this.lowestLevel) < 0 || !this.filter(record)) {
      return;
    }
    for (const sink of this.getSinks(record.level)) {
      if (bypassSinks?.has(sink)) continue;
      try {
        sink(record);
      } catch (error) {
        const bypassSinks2 = new Set(bypassSinks);
        bypassSinks2.add(sink);
        metaLogger.log("fatal", "Failed to emit a log record to sink {sink}: {error}", {
          sink,
          error,
          record
        }, bypassSinks2);
      }
    }
  }
  log(level, rawMessage, properties, bypassSinks) {
    const implicitContext = LoggerImpl.getLogger().contextLocalStorage?.getStore() ?? {};
    let cachedProps = void 0;
    const record = typeof properties === "function" ? {
      category: this.category,
      level,
      timestamp: Date.now(),
      get message() {
        return parseMessageTemplate(rawMessage, this.properties);
      },
      rawMessage,
      get properties() {
        if (cachedProps == null) {
          cachedProps = {
            ...implicitContext,
            ...properties()
          };
        }
        return cachedProps;
      }
    } : {
      category: this.category,
      level,
      timestamp: Date.now(),
      message: parseMessageTemplate(rawMessage, {
        ...implicitContext,
        ...properties
      }),
      rawMessage,
      properties: {
        ...implicitContext,
        ...properties
      }
    };
    this.emit(record, bypassSinks);
  }
  logLazily(level, callback, properties = {}) {
    const implicitContext = LoggerImpl.getLogger().contextLocalStorage?.getStore() ?? {};
    let rawMessage = void 0;
    let msg = void 0;
    function realizeMessage() {
      if (msg == null || rawMessage == null) {
        msg = callback((tpl, ...values) => {
          rawMessage = tpl;
          return renderMessage(tpl, values);
        });
        if (rawMessage == null) throw new TypeError("No log record was made.");
      }
      return [
        msg,
        rawMessage
      ];
    }
    this.emit({
      category: this.category,
      level,
      get message() {
        return realizeMessage()[0];
      },
      get rawMessage() {
        return realizeMessage()[1];
      },
      timestamp: Date.now(),
      properties: {
        ...implicitContext,
        ...properties
      }
    });
  }
  logTemplate(level, messageTemplate, values, properties = {}) {
    const implicitContext = LoggerImpl.getLogger().contextLocalStorage?.getStore() ?? {};
    this.emit({
      category: this.category,
      level,
      message: renderMessage(messageTemplate, values),
      rawMessage: messageTemplate,
      timestamp: Date.now(),
      properties: {
        ...implicitContext,
        ...properties
      }
    });
  }
  debug(message, ...values) {
    if (typeof message === "string") {
      this.log("debug", message, values[0] ?? {});
    } else if (typeof message === "function") {
      this.logLazily("debug", message);
    } else {
      this.logTemplate("debug", message, values);
    }
  }
  info(message, ...values) {
    if (typeof message === "string") {
      this.log("info", message, values[0] ?? {});
    } else if (typeof message === "function") {
      this.logLazily("info", message);
    } else {
      this.logTemplate("info", message, values);
    }
  }
  warn(message, ...values) {
    if (typeof message === "string") {
      this.log("warning", message, values[0] ?? {});
    } else if (typeof message === "function") {
      this.logLazily("warning", message);
    } else {
      this.logTemplate("warning", message, values);
    }
  }
  error(message, ...values) {
    if (typeof message === "string") {
      this.log("error", message, values[0] ?? {});
    } else if (typeof message === "function") {
      this.logLazily("error", message);
    } else {
      this.logTemplate("error", message, values);
    }
  }
  fatal(message, ...values) {
    if (typeof message === "string") {
      this.log("fatal", message, values[0] ?? {});
    } else if (typeof message === "function") {
      this.logLazily("fatal", message);
    } else {
      this.logTemplate("fatal", message, values);
    }
  }
}
class LoggerCtx {
  logger;
  properties;
  constructor(logger, properties) {
    this.logger = logger;
    this.properties = properties;
  }
  get category() {
    return this.logger.category;
  }
  get parent() {
    return this.logger.parent;
  }
  getChild(subcategory) {
    return this.logger.getChild(subcategory).with(this.properties);
  }
  with(properties) {
    return new LoggerCtx(this.logger, {
      ...this.properties,
      ...properties
    });
  }
  log(level, message, properties, bypassSinks) {
    this.logger.log(level, message, typeof properties === "function" ? () => ({
      ...this.properties,
      ...properties()
    }) : {
      ...this.properties,
      ...properties
    }, bypassSinks);
  }
  logLazily(level, callback) {
    this.logger.logLazily(level, callback, this.properties);
  }
  logTemplate(level, messageTemplate, values) {
    this.logger.logTemplate(level, messageTemplate, values, this.properties);
  }
  debug(message, ...values) {
    if (typeof message === "string") {
      this.log("debug", message, values[0] ?? {});
    } else if (typeof message === "function") {
      this.logLazily("debug", message);
    } else {
      this.logTemplate("debug", message, values);
    }
  }
  info(message, ...values) {
    if (typeof message === "string") {
      this.log("info", message, values[0] ?? {});
    } else if (typeof message === "function") {
      this.logLazily("info", message);
    } else {
      this.logTemplate("info", message, values);
    }
  }
  warn(message, ...values) {
    if (typeof message === "string") {
      this.log("warning", message, values[0] ?? {});
    } else if (typeof message === "function") {
      this.logLazily("warning", message);
    } else {
      this.logTemplate("warning", message, values);
    }
  }
  error(message, ...values) {
    if (typeof message === "string") {
      this.log("error", message, values[0] ?? {});
    } else if (typeof message === "function") {
      this.logLazily("error", message);
    } else {
      this.logTemplate("error", message, values);
    }
  }
  fatal(message, ...values) {
    if (typeof message === "string") {
      this.log("fatal", message, values[0] ?? {});
    } else if (typeof message === "function") {
      this.logLazily("fatal", message);
    } else {
      this.logTemplate("fatal", message, values);
    }
  }
}
const metaLogger = LoggerImpl.getLogger([
  "logtape",
  "meta"
]);
function parseMessageTemplate(template, properties) {
  const message = [];
  let part = "";
  for (let i = 0; i < template.length; i++) {
    const char = template.charAt(i);
    const nextChar = template.charAt(i + 1);
    if (char === "{" && nextChar === "{") {
      part = part + char;
      i++;
    } else if (char === "}" && nextChar === "}") {
      part = part + char;
      i++;
    } else if (char === "{") {
      message.push(part);
      part = "";
    } else if (char === "}") {
      let prop;
      if (part.match(/^\s|\s$/)) {
        prop = part in properties ? properties[part] : properties[part.trim()];
      } else {
        prop = properties[part];
      }
      message.push(prop);
      part = "";
    } else {
      part = part + char;
    }
  }
  message.push(part);
  return message;
}
function renderMessage(template, values) {
  const args = [];
  for (let i = 0; i < template.length; i++) {
    args.push(template[i]);
    if (i < values.length) args.push(values[i]);
  }
  return args;
}
const util$1 = {};
const __viteBrowserExternal = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: util$1
}, Symbol.toStringTag, { value: "Module" }));
const levelAbbreviations = {
  "debug": "DBG",
  "info": "INF",
  "warning": "WRN",
  "error": "ERR",
  "fatal": "FTL"
};
const inspect = (
  // @ts-ignore: Deno global
  // dnt-shim-ignore
  "Deno" in globalThis && "inspect" in globalThis.Deno && // @ts-ignore: Deno global
  // dnt-shim-ignore
  typeof globalThis.Deno.inspect === "function" ? (v, opts) => (
    // @ts-ignore: Deno global
    // dnt-shim-ignore
    globalThis.Deno.inspect(v, {
      strAbbreviateSize: Infinity,
      iterableLimit: Infinity,
      ...opts
    })
  ) : util$1 != null && "inspect" in util$1 && typeof util$1.inspect === "function" ? (v, opts) => (
    // @ts-ignore: Node.js global
    // dnt-shim-ignore
    util$1.inspect(v, {
      maxArrayLength: Infinity,
      maxStringLength: Infinity,
      ...opts
    })
  ) : (v) => JSON.stringify(v)
);
function getTextFormatter(options = {}) {
  const timestampRenderer = options.timestamp == null || options.timestamp === "date-time-timezone" ? (ts) => new Date(ts).toISOString().replace("T", " ").replace("Z", " +00:00") : options.timestamp === "date-time-tz" ? (ts) => new Date(ts).toISOString().replace("T", " ").replace("Z", " +00") : options.timestamp === "date-time" ? (ts) => new Date(ts).toISOString().replace("T", " ").replace("Z", "") : options.timestamp === "time-timezone" ? (ts) => new Date(ts).toISOString().replace(/.*T/, "").replace("Z", " +00:00") : options.timestamp === "time-tz" ? (ts) => new Date(ts).toISOString().replace(/.*T/, "").replace("Z", " +00") : options.timestamp === "time" ? (ts) => new Date(ts).toISOString().replace(/.*T/, "").replace("Z", "") : options.timestamp === "date" ? (ts) => new Date(ts).toISOString().replace(/T.*/, "") : options.timestamp === "rfc3339" ? (ts) => new Date(ts).toISOString() : options.timestamp;
  const categorySeparator = options.category ?? "·";
  const valueRenderer = options.value ?? inspect;
  const levelRenderer = options.level == null || options.level === "ABBR" ? (level) => levelAbbreviations[level] : options.level === "abbr" ? (level) => levelAbbreviations[level].toLowerCase() : options.level === "FULL" ? (level) => level.toUpperCase() : options.level === "full" ? (level) => level : options.level === "L" ? (level) => level.charAt(0).toUpperCase() : options.level === "l" ? (level) => level.charAt(0) : options.level;
  const formatter = options.format ?? (({ timestamp, level, category, message }) => `${timestamp} [${level}] ${category}: ${message}`);
  return (record) => {
    let message = "";
    for (let i = 0; i < record.message.length; i++) {
      if (i % 2 === 0) message += record.message[i];
      else message += valueRenderer(record.message[i]);
    }
    const timestamp = timestampRenderer(record.timestamp);
    const level = levelRenderer(record.level);
    const category = typeof categorySeparator === "function" ? categorySeparator(record.category) : record.category.join(categorySeparator);
    const values = {
      timestamp,
      level,
      category,
      message,
      record
    };
    return `${formatter(values)}
`;
  };
}
const defaultTextFormatter = getTextFormatter();
const RESET = "\x1B[0m";
const ansiColors = {
  black: "\x1B[30m",
  red: "\x1B[31m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  blue: "\x1B[34m",
  magenta: "\x1B[35m",
  cyan: "\x1B[36m",
  white: "\x1B[37m"
};
const ansiStyles = {
  bold: "\x1B[1m",
  dim: "\x1B[2m",
  italic: "\x1B[3m",
  underline: "\x1B[4m",
  strikethrough: "\x1B[9m"
};
const defaultLevelColors = {
  debug: "blue",
  info: "green",
  warning: "yellow",
  error: "red",
  fatal: "magenta"
};
function getAnsiColorFormatter(options = {}) {
  const format = options.format;
  const timestampStyle = typeof options.timestampStyle === "undefined" ? "dim" : options.timestampStyle;
  const timestampColor = options.timestampColor ?? null;
  const timestampPrefix = `${timestampStyle == null ? "" : ansiStyles[timestampStyle]}${timestampColor == null ? "" : ansiColors[timestampColor]}`;
  const timestampSuffix = timestampStyle == null && timestampColor == null ? "" : RESET;
  const levelStyle = typeof options.levelStyle === "undefined" ? "bold" : options.levelStyle;
  const levelColors = options.levelColors ?? defaultLevelColors;
  const categoryStyle = typeof options.categoryStyle === "undefined" ? "dim" : options.categoryStyle;
  const categoryColor = options.categoryColor ?? null;
  const categoryPrefix = `${categoryStyle == null ? "" : ansiStyles[categoryStyle]}${categoryColor == null ? "" : ansiColors[categoryColor]}`;
  const categorySuffix = categoryStyle == null && categoryColor == null ? "" : RESET;
  return getTextFormatter({
    timestamp: "date-time-tz",
    value(value) {
      return inspect(value, {
        colors: true
      });
    },
    ...options,
    format({ timestamp, level, category, message, record }) {
      const levelColor = levelColors[record.level];
      timestamp = `${timestampPrefix}${timestamp}${timestampSuffix}`;
      level = `${levelStyle == null ? "" : ansiStyles[levelStyle]}${levelColor == null ? "" : ansiColors[levelColor]}${level}${levelStyle == null && levelColor == null ? "" : RESET}`;
      return format == null ? `${timestamp} ${level} ${categoryPrefix}${category}:${categorySuffix} ${message}` : format({
        timestamp,
        level,
        category: `${categoryPrefix}${category}${categorySuffix}`,
        message,
        record
      });
    }
  });
}
getAnsiColorFormatter();
const logLevelStyles = {
  "debug": "background-color: gray; color: white;",
  "info": "background-color: white; color: black;",
  "warning": "background-color: orange; color: black;",
  "error": "background-color: red; color: white;",
  "fatal": "background-color: maroon; color: white;"
};
function defaultConsoleFormatter(record) {
  let msg = "";
  const values = [];
  for (let i = 0; i < record.message.length; i++) {
    if (i % 2 === 0) msg += record.message[i];
    else {
      msg += "%o";
      values.push(record.message[i]);
    }
  }
  const date = new Date(record.timestamp);
  const time = `${date.getUTCHours().toString().padStart(2, "0")}:${date.getUTCMinutes().toString().padStart(2, "0")}:${date.getUTCSeconds().toString().padStart(2, "0")}.${date.getUTCMilliseconds().toString().padStart(3, "0")}`;
  return [
    `%c${time} %c${levelAbbreviations[record.level]}%c %c${record.category.join("·")} %c${msg}`,
    "color: gray;",
    logLevelStyles[record.level],
    "background-color: default;",
    "color: gray;",
    "color: default;",
    ...values
  ];
}
function withFilter(sink, filter) {
  const filterFunc = toFilter(filter);
  return (record) => {
    if (filterFunc(record)) sink(record);
  };
}
function getStreamSink(stream, options = {}) {
  const formatter = options.formatter ?? defaultTextFormatter;
  const encoder = options.encoder ?? new TextEncoder();
  const writer = stream.getWriter();
  let lastPromise = Promise.resolve();
  const sink = (record) => {
    const bytes = encoder.encode(formatter(record));
    lastPromise = lastPromise.then(() => writer.ready).then(() => writer.write(bytes));
  };
  sink[Symbol.asyncDispose] = async () => {
    await lastPromise;
    await writer.close();
  };
  return sink;
}
function getConsoleSink(options = {}) {
  const formatter = options.formatter ?? defaultConsoleFormatter;
  const levelMap = {
    debug: "debug",
    info: "info",
    warning: "warn",
    error: "error",
    fatal: "error",
    ...options.levelMap ?? {}
  };
  const console2 = options.console ?? globalThis.console;
  return (record) => {
    const args = formatter(record);
    const method = levelMap[record.level];
    if (method === void 0) {
      throw new TypeError(`Invalid log level: ${record.level}.`);
    }
    if (typeof args === "string") {
      const msg = args.replace(/\r?\n$/, "");
      console2[method](msg);
    } else {
      console2[method](...args);
    }
  };
}
let currentConfig = null;
const strongRefs = /* @__PURE__ */ new Set();
const disposables = /* @__PURE__ */ new Set();
const asyncDisposables = /* @__PURE__ */ new Set();
function isLoggerConfigMeta(cfg) {
  return cfg.category.length === 0 || cfg.category.length === 1 && cfg.category[0] === "logtape" || cfg.category.length === 2 && cfg.category[0] === "logtape" && cfg.category[1] === "meta";
}
async function configure(config) {
  if (currentConfig != null && !config.reset) {
    throw new ConfigError("Already configured; if you want to reset, turn on the reset flag.");
  }
  await reset();
  try {
    configureInternal(config, true);
  } catch (e2) {
    if (e2 instanceof ConfigError) await reset();
    throw e2;
  }
}
function configureInternal(config, allowAsync) {
  currentConfig = config;
  let metaConfigured = false;
  let levelUsed = false;
  for (const cfg of config.loggers) {
    if (isLoggerConfigMeta(cfg)) {
      metaConfigured = true;
    }
    const logger = LoggerImpl.getLogger(cfg.category);
    for (const sinkId of cfg.sinks ?? []) {
      const sink = config.sinks[sinkId];
      if (!sink) {
        throw new ConfigError(`Sink not found: ${sinkId}.`);
      }
      logger.sinks.push(sink);
    }
    logger.parentSinks = cfg.parentSinks ?? "inherit";
    if (cfg.lowestLevel !== void 0) {
      logger.lowestLevel = cfg.lowestLevel;
    }
    if (cfg.level !== void 0) {
      levelUsed = true;
      logger.filters.push(toFilter(cfg.level));
    }
    for (const filterId of cfg.filters ?? []) {
      const filter = config.filters?.[filterId];
      if (filter === void 0) {
        throw new ConfigError(`Filter not found: ${filterId}.`);
      }
      logger.filters.push(toFilter(filter));
    }
    strongRefs.add(logger);
  }
  LoggerImpl.getLogger().contextLocalStorage = config.contextLocalStorage;
  for (const sink of Object.values(config.sinks)) {
    if (Symbol.asyncDispose in sink) {
      asyncDisposables.add(sink);
    }
    if (Symbol.dispose in sink) disposables.add(sink);
  }
  for (const filter of Object.values(config.filters ?? {})) {
    if (filter == null || typeof filter === "string") continue;
    if (Symbol.asyncDispose in filter) {
      asyncDisposables.add(filter);
    }
    if (Symbol.dispose in filter) disposables.add(filter);
  }
  if ("process" in globalThis && !("Deno" in globalThis)) {
    process.on("exit", dispose);
  } else {
    addEventListener("unload", dispose);
  }
  const meta = LoggerImpl.getLogger([
    "logtape",
    "meta"
  ]);
  if (!metaConfigured) {
    meta.sinks.push(getConsoleSink());
  }
  meta.info("LogTape loggers are configured.  Note that LogTape itself uses the meta logger, which has category {metaLoggerCategory}.  The meta logger purposes to log internal errors such as sink exceptions.  If you are seeing this message, the meta logger is automatically configured.  It's recommended to configure the meta logger with a separate sink so that you can easily notice if logging itself fails or is misconfigured.  To turn off this message, configure the meta logger with higher log levels than {dismissLevel}.  See also <https://logtape.org/manual/categories#meta-logger>.", {
    metaLoggerCategory: [
      "logtape",
      "meta"
    ],
    dismissLevel: "info"
  });
  if (levelUsed) {
    meta.warn("The level option is deprecated in favor of lowestLevel option.  Please update your configuration.  See also <https://logtape.org/manual/levels#configuring-severity-levels>.");
  }
}
async function reset() {
  await dispose();
  resetInternal();
}
function resetInternal() {
  const rootLogger = LoggerImpl.getLogger([]);
  rootLogger.resetDescendants();
  delete rootLogger.contextLocalStorage;
  strongRefs.clear();
  currentConfig = null;
}
async function dispose() {
  disposeSync();
  const promises = [];
  for (const disposable of asyncDisposables) {
    promises.push(disposable[Symbol.asyncDispose]());
    asyncDisposables.delete(disposable);
  }
  await Promise.all(promises);
}
function disposeSync() {
  for (const disposable of disposables) disposable[Symbol.dispose]();
  disposables.clear();
}
class ConfigError extends Error {
  /**
   * Constructs a new configuration error.
   * @param message The error message.
   */
  constructor(message) {
    super(message);
    this.name = "ConfigureError";
  }
}
const fallbackConfiguration = {
  reset: true,
  sinks: {
    console: getConsoleSink(),
    consoleInfoPlus: withFilter(getConsoleSink(), getLevelFilter("info")),
    consoleWarnPlus: withFilter(getConsoleSink(), getLevelFilter("warning"))
  },
  filters: {},
  loggers: [
    /* a is short for app, m is short for module, t is short for test
         Sorry, but terminal space is precious. */
    { category: ["a"], lowestLevel: "debug", sinks: ["console"] },
    { category: ["t"], lowestLevel: "debug", sinks: ["consoleInfoPlus"] },
    { category: ["m"], lowestLevel: "debug", sinks: ["consoleInfoPlus"] },
    {
      category: ["esbuild-plugin"],
      lowestLevel: "debug",
      sinks: ["consoleWarnPlus"]
    },
    { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["console"] }
  ]
};
const logtapeConfiguration = /* @__NO_SIDE_EFFECTS__ */ async (appName = "monochromatic") => {
  try {
    const fileSink = await (async () => {
      try {
        const opfsRoot = await navigator.storage.getDirectory();
        const fileHandle = await opfsRoot.getFileHandle(appName, {
          create: true
        });
        const writableStream = await fileHandle.createWritable();
        const fileSink2 = getStreamSink(writableStream, {
          formatter(log) {
            return `${JSON.stringify(log, null, 2)}
`;
          }
        });
        fileSink2[Symbol.asyncDispose] = async () => {
          console.log("disposing OPFS sink");
          await writableStream.close();
          console.log("disposed OPFS sink", "with file content", await (await fileHandle.getFile()).text());
        };
        return fileSink2;
      } catch (opfsError) {
        console.log(`opfs failed with ${opfsError}, trying sessionStorage`);
        window.sessionStorage.setItem("test", "test");
        window.sessionStorage.removeItem("test");
        window.sessionStorage.setItem(`${appName}.line`, "-1");
        const fileSink2 = (record) => {
          window.sessionStorage.setItem(`${appName}.line`, String(Number(window.sessionStorage.getItem(`${appName}.line`) + 1)));
          window.sessionStorage.setItem(
            `${appName}.${window.sessionStorage.getItem(`${appName}.line`)}`,
            `${JSON.stringify(record, null, 2)}
`
          );
        };
        fileSink2[Symbol.asyncDispose] = async () => {
          console.log("disposing sessionStorage sink");
          const lines = Array.from({ length: Number(window.sessionStorage.getItem(`${appName}.line`)) }).map((_value, lineNumber) => {
            const line = window.sessionStorage.getItem(`${appName}.${lineNumber}`);
            window.sessionStorage.removeItem(`${appName}.${lineNumber}`);
            return line;
          });
          window.sessionStorage.removeItem(`${appName}.line`);
          const content = lines.join("\n");
          console.log("disposed sessionStorage sink", "with file content", content);
        };
        return fileSink2;
      }
    })();
    return {
      reset: true,
      sinks: {
        console: getConsoleSink(),
        consoleInfoPlus: withFilter(getConsoleSink(), getLevelFilter("info")),
        consoleWarnPlus: withFilter(getConsoleSink(), getLevelFilter("warning")),
        file: fileSink
      },
      filters: {},
      loggers: [
        /* a is short for app, m is short for module, t is short for test
             Sorry, but terminal space is precious. */
        { category: ["a"], lowestLevel: "debug", sinks: ["file", "consoleInfoPlus"] },
        { category: ["t"], lowestLevel: "debug", sinks: ["file", "consoleInfoPlus"] },
        { category: ["m"], lowestLevel: "debug", sinks: ["file", "consoleWarnPlus"] },
        {
          category: ["esbuild-plugin"],
          lowestLevel: "debug",
          sinks: ["file", "consoleWarnPlus"]
        },
        { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["console"] }
      ]
    };
  } catch (error) {
    console.log(
      `Not running in node but both navigator.storage.getDirectory() and window.sessionStorage are unavailable because of ${error}, falling back to console logging only. App debug messages and module info messages would be logged to console in this mode.`
    );
    return fallbackConfiguration;
  }
};
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
function getAugmentedNamespace(n) {
  if (Object.prototype.hasOwnProperty.call(n, "__esModule")) return n;
  var f = n.default;
  if (typeof f == "function") {
    var a = function a2() {
      if (this instanceof a2) {
        return Reflect.construct(f, arguments, this.constructor);
      }
      return f.apply(this, arguments);
    };
    a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, "__esModule", { value: true });
  Object.keys(n).forEach(function(k) {
    var d = Object.getOwnPropertyDescriptor(n, k);
    Object.defineProperty(a, k, d.get ? d : {
      enumerable: true,
      get: function() {
        return n[k];
      }
    });
  });
  return a;
}
var picocolors_browser = { exports: {} };
var hasRequiredPicocolors_browser;
function requirePicocolors_browser() {
  if (hasRequiredPicocolors_browser) return picocolors_browser.exports;
  hasRequiredPicocolors_browser = 1;
  var x = String;
  var create = function() {
    return { isColorSupported: false, reset: x, bold: x, dim: x, italic: x, underline: x, inverse: x, hidden: x, strikethrough: x, black: x, red: x, green: x, yellow: x, blue: x, magenta: x, cyan: x, white: x, gray: x, bgBlack: x, bgRed: x, bgGreen: x, bgYellow: x, bgBlue: x, bgMagenta: x, bgCyan: x, bgWhite: x, blackBright: x, redBright: x, greenBright: x, yellowBright: x, blueBright: x, magentaBright: x, cyanBright: x, whiteBright: x, bgBlackBright: x, bgRedBright: x, bgGreenBright: x, bgYellowBright: x, bgBlueBright: x, bgMagentaBright: x, bgCyanBright: x, bgWhiteBright: x };
  };
  picocolors_browser.exports = create();
  picocolors_browser.exports.createColors = create;
  return picocolors_browser.exports;
}
const require$$2 = /* @__PURE__ */ getAugmentedNamespace(__viteBrowserExternal);
var cssSyntaxError;
var hasRequiredCssSyntaxError;
function requireCssSyntaxError() {
  if (hasRequiredCssSyntaxError) return cssSyntaxError;
  hasRequiredCssSyntaxError = 1;
  let pico = /* @__PURE__ */ requirePicocolors_browser();
  let terminalHighlight = require$$2;
  class CssSyntaxError extends Error {
    constructor(message, line, column, source, file, plugin) {
      super(message);
      this.name = "CssSyntaxError";
      this.reason = message;
      if (file) {
        this.file = file;
      }
      if (source) {
        this.source = source;
      }
      if (plugin) {
        this.plugin = plugin;
      }
      if (typeof line !== "undefined" && typeof column !== "undefined") {
        if (typeof line === "number") {
          this.line = line;
          this.column = column;
        } else {
          this.line = line.line;
          this.column = line.column;
          this.endLine = column.line;
          this.endColumn = column.column;
        }
      }
      this.setMessage();
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, CssSyntaxError);
      }
    }
    setMessage() {
      this.message = this.plugin ? this.plugin + ": " : "";
      this.message += this.file ? this.file : "<css input>";
      if (typeof this.line !== "undefined") {
        this.message += ":" + this.line + ":" + this.column;
      }
      this.message += ": " + this.reason;
    }
    showSourceCode(color) {
      if (!this.source) return "";
      let css = this.source;
      if (color == null) color = pico.isColorSupported;
      let aside = (text) => text;
      let mark = (text) => text;
      let highlight = (text) => text;
      if (color) {
        let { bold, gray, red } = pico.createColors(true);
        mark = (text) => bold(red(text));
        aside = (text) => gray(text);
        if (terminalHighlight) {
          highlight = (text) => terminalHighlight(text);
        }
      }
      let lines = css.split(/\r?\n/);
      let start = Math.max(this.line - 3, 0);
      let end = Math.min(this.line + 2, lines.length);
      let maxWidth = String(end).length;
      return lines.slice(start, end).map((line, index) => {
        let number = start + 1 + index;
        let gutter = " " + (" " + number).slice(-maxWidth) + " | ";
        if (number === this.line) {
          if (line.length > 160) {
            let padding = 20;
            let subLineStart = Math.max(0, this.column - padding);
            let subLineEnd = Math.max(
              this.column + padding,
              this.endColumn + padding
            );
            let subLine = line.slice(subLineStart, subLineEnd);
            let spacing2 = aside(gutter.replace(/\d/g, " ")) + line.slice(0, Math.min(this.column - 1, padding - 1)).replace(/[^\t]/g, " ");
            return mark(">") + aside(gutter) + highlight(subLine) + "\n " + spacing2 + mark("^");
          }
          let spacing = aside(gutter.replace(/\d/g, " ")) + line.slice(0, this.column - 1).replace(/[^\t]/g, " ");
          return mark(">") + aside(gutter) + highlight(line) + "\n " + spacing + mark("^");
        }
        return " " + aside(gutter) + highlight(line);
      }).join("\n");
    }
    toString() {
      let code = this.showSourceCode();
      if (code) {
        code = "\n\n" + code + "\n";
      }
      return this.name + ": " + this.message + code;
    }
  }
  cssSyntaxError = CssSyntaxError;
  CssSyntaxError.default = CssSyntaxError;
  return cssSyntaxError;
}
var stringifier$1;
var hasRequiredStringifier$1;
function requireStringifier$1() {
  if (hasRequiredStringifier$1) return stringifier$1;
  hasRequiredStringifier$1 = 1;
  const DEFAULT_RAW = {
    after: "\n",
    beforeClose: "\n",
    beforeComment: "\n",
    beforeDecl: "\n",
    beforeOpen: " ",
    beforeRule: "\n",
    colon: ": ",
    commentLeft: " ",
    commentRight: " ",
    emptyBody: "",
    indent: "    ",
    semicolon: false
  };
  function capitalize(str) {
    return str[0].toUpperCase() + str.slice(1);
  }
  class Stringifier {
    constructor(builder) {
      this.builder = builder;
    }
    atrule(node2, semicolon) {
      let name = "@" + node2.name;
      let params = node2.params ? this.rawValue(node2, "params") : "";
      if (typeof node2.raws.afterName !== "undefined") {
        name += node2.raws.afterName;
      } else if (params) {
        name += " ";
      }
      if (node2.nodes) {
        this.block(node2, name + params);
      } else {
        let end = (node2.raws.between || "") + (semicolon ? ";" : "");
        this.builder(name + params + end, node2);
      }
    }
    beforeAfter(node2, detect) {
      let value;
      if (node2.type === "decl") {
        value = this.raw(node2, null, "beforeDecl");
      } else if (node2.type === "comment") {
        value = this.raw(node2, null, "beforeComment");
      } else if (detect === "before") {
        value = this.raw(node2, null, "beforeRule");
      } else {
        value = this.raw(node2, null, "beforeClose");
      }
      let buf = node2.parent;
      let depth = 0;
      while (buf && buf.type !== "root") {
        depth += 1;
        buf = buf.parent;
      }
      if (value.includes("\n")) {
        let indent = this.raw(node2, null, "indent");
        if (indent.length) {
          for (let step = 0; step < depth; step++) value += indent;
        }
      }
      return value;
    }
    block(node2, start) {
      let between = this.raw(node2, "between", "beforeOpen");
      this.builder(start + between + "{", node2, "start");
      let after;
      if (node2.nodes && node2.nodes.length) {
        this.body(node2);
        after = this.raw(node2, "after");
      } else {
        after = this.raw(node2, "after", "emptyBody");
      }
      if (after) this.builder(after);
      this.builder("}", node2, "end");
    }
    body(node2) {
      let last = node2.nodes.length - 1;
      while (last > 0) {
        if (node2.nodes[last].type !== "comment") break;
        last -= 1;
      }
      let semicolon = this.raw(node2, "semicolon");
      for (let i = 0; i < node2.nodes.length; i++) {
        let child = node2.nodes[i];
        let before = this.raw(child, "before");
        if (before) this.builder(before);
        this.stringify(child, last !== i || semicolon);
      }
    }
    comment(node2) {
      let left = this.raw(node2, "left", "commentLeft");
      let right = this.raw(node2, "right", "commentRight");
      this.builder("/*" + left + node2.text + right + "*/", node2);
    }
    decl(node2, semicolon) {
      let between = this.raw(node2, "between", "colon");
      let string2 = node2.prop + between + this.rawValue(node2, "value");
      if (node2.important) {
        string2 += node2.raws.important || " !important";
      }
      if (semicolon) string2 += ";";
      this.builder(string2, node2);
    }
    document(node2) {
      this.body(node2);
    }
    raw(node2, own, detect) {
      let value;
      if (!detect) detect = own;
      if (own) {
        value = node2.raws[own];
        if (typeof value !== "undefined") return value;
      }
      let parent2 = node2.parent;
      if (detect === "before") {
        if (!parent2 || parent2.type === "root" && parent2.first === node2) {
          return "";
        }
        if (parent2 && parent2.type === "document") {
          return "";
        }
      }
      if (!parent2) return DEFAULT_RAW[detect];
      let root2 = node2.root();
      if (!root2.rawCache) root2.rawCache = {};
      if (typeof root2.rawCache[detect] !== "undefined") {
        return root2.rawCache[detect];
      }
      if (detect === "before" || detect === "after") {
        return this.beforeAfter(node2, detect);
      } else {
        let method = "raw" + capitalize(detect);
        if (this[method]) {
          value = this[method](root2, node2);
        } else {
          root2.walk((i) => {
            value = i.raws[own];
            if (typeof value !== "undefined") return false;
          });
        }
      }
      if (typeof value === "undefined") value = DEFAULT_RAW[detect];
      root2.rawCache[detect] = value;
      return value;
    }
    rawBeforeClose(root2) {
      let value;
      root2.walk((i) => {
        if (i.nodes && i.nodes.length > 0) {
          if (typeof i.raws.after !== "undefined") {
            value = i.raws.after;
            if (value.includes("\n")) {
              value = value.replace(/[^\n]+$/, "");
            }
            return false;
          }
        }
      });
      if (value) value = value.replace(/\S/g, "");
      return value;
    }
    rawBeforeComment(root2, node2) {
      let value;
      root2.walkComments((i) => {
        if (typeof i.raws.before !== "undefined") {
          value = i.raws.before;
          if (value.includes("\n")) {
            value = value.replace(/[^\n]+$/, "");
          }
          return false;
        }
      });
      if (typeof value === "undefined") {
        value = this.raw(node2, null, "beforeDecl");
      } else if (value) {
        value = value.replace(/\S/g, "");
      }
      return value;
    }
    rawBeforeDecl(root2, node2) {
      let value;
      root2.walkDecls((i) => {
        if (typeof i.raws.before !== "undefined") {
          value = i.raws.before;
          if (value.includes("\n")) {
            value = value.replace(/[^\n]+$/, "");
          }
          return false;
        }
      });
      if (typeof value === "undefined") {
        value = this.raw(node2, null, "beforeRule");
      } else if (value) {
        value = value.replace(/\S/g, "");
      }
      return value;
    }
    rawBeforeOpen(root2) {
      let value;
      root2.walk((i) => {
        if (i.type !== "decl") {
          value = i.raws.between;
          if (typeof value !== "undefined") return false;
        }
      });
      return value;
    }
    rawBeforeRule(root2) {
      let value;
      root2.walk((i) => {
        if (i.nodes && (i.parent !== root2 || root2.first !== i)) {
          if (typeof i.raws.before !== "undefined") {
            value = i.raws.before;
            if (value.includes("\n")) {
              value = value.replace(/[^\n]+$/, "");
            }
            return false;
          }
        }
      });
      if (value) value = value.replace(/\S/g, "");
      return value;
    }
    rawColon(root2) {
      let value;
      root2.walkDecls((i) => {
        if (typeof i.raws.between !== "undefined") {
          value = i.raws.between.replace(/[^\s:]/g, "");
          return false;
        }
      });
      return value;
    }
    rawEmptyBody(root2) {
      let value;
      root2.walk((i) => {
        if (i.nodes && i.nodes.length === 0) {
          value = i.raws.after;
          if (typeof value !== "undefined") return false;
        }
      });
      return value;
    }
    rawIndent(root2) {
      if (root2.raws.indent) return root2.raws.indent;
      let value;
      root2.walk((i) => {
        let p = i.parent;
        if (p && p !== root2 && p.parent && p.parent === root2) {
          if (typeof i.raws.before !== "undefined") {
            let parts = i.raws.before.split("\n");
            value = parts[parts.length - 1];
            value = value.replace(/\S/g, "");
            return false;
          }
        }
      });
      return value;
    }
    rawSemicolon(root2) {
      let value;
      root2.walk((i) => {
        if (i.nodes && i.nodes.length && i.last.type === "decl") {
          value = i.raws.semicolon;
          if (typeof value !== "undefined") return false;
        }
      });
      return value;
    }
    rawValue(node2, prop) {
      let value = node2[prop];
      let raw = node2.raws[prop];
      if (raw && raw.value === value) {
        return raw.raw;
      }
      return value;
    }
    root(node2) {
      this.body(node2);
      if (node2.raws.after) this.builder(node2.raws.after);
    }
    rule(node2) {
      this.block(node2, this.rawValue(node2, "selector"));
      if (node2.raws.ownSemicolon) {
        this.builder(node2.raws.ownSemicolon, node2, "end");
      }
    }
    stringify(node2, semicolon) {
      if (!this[node2.type]) {
        throw new Error(
          "Unknown AST node type " + node2.type + ". Maybe you need to change PostCSS stringifier."
        );
      }
      this[node2.type](node2, semicolon);
    }
  }
  stringifier$1 = Stringifier;
  Stringifier.default = Stringifier;
  return stringifier$1;
}
var stringify_1$1;
var hasRequiredStringify$1;
function requireStringify$1() {
  if (hasRequiredStringify$1) return stringify_1$1;
  hasRequiredStringify$1 = 1;
  let Stringifier = requireStringifier$1();
  function stringify(node2, builder) {
    let str = new Stringifier(builder);
    str.stringify(node2);
  }
  stringify_1$1 = stringify;
  stringify.default = stringify;
  return stringify_1$1;
}
var symbols = {};
var hasRequiredSymbols;
function requireSymbols() {
  if (hasRequiredSymbols) return symbols;
  hasRequiredSymbols = 1;
  symbols.isClean = Symbol("isClean");
  symbols.my = Symbol("my");
  return symbols;
}
var node$1;
var hasRequiredNode$1;
function requireNode$1() {
  if (hasRequiredNode$1) return node$1;
  hasRequiredNode$1 = 1;
  let CssSyntaxError = requireCssSyntaxError();
  let Stringifier = requireStringifier$1();
  let stringify = requireStringify$1();
  let { isClean, my } = requireSymbols();
  function cloneNode(obj, parent2) {
    let cloned = new obj.constructor();
    for (let i in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, i)) {
        continue;
      }
      if (i === "proxyCache") continue;
      let value = obj[i];
      let type = typeof value;
      if (i === "parent" && type === "object") {
        if (parent2) cloned[i] = parent2;
      } else if (i === "source") {
        cloned[i] = value;
      } else if (Array.isArray(value)) {
        cloned[i] = value.map((j) => cloneNode(j, cloned));
      } else {
        if (type === "object" && value !== null) value = cloneNode(value);
        cloned[i] = value;
      }
    }
    return cloned;
  }
  function sourceOffset(inputCSS, position) {
    if (position && typeof position.offset !== "undefined") {
      return position.offset;
    }
    let column = 1;
    let line = 1;
    let offset = 0;
    for (let i = 0; i < inputCSS.length; i++) {
      if (line === position.line && column === position.column) {
        offset = i;
        break;
      }
      if (inputCSS[i] === "\n") {
        column = 1;
        line += 1;
      } else {
        column += 1;
      }
    }
    return offset;
  }
  class Node {
    get proxyOf() {
      return this;
    }
    constructor(defaults = {}) {
      this.raws = {};
      this[isClean] = false;
      this[my] = true;
      for (let name in defaults) {
        if (name === "nodes") {
          this.nodes = [];
          for (let node2 of defaults[name]) {
            if (typeof node2.clone === "function") {
              this.append(node2.clone());
            } else {
              this.append(node2);
            }
          }
        } else {
          this[name] = defaults[name];
        }
      }
    }
    addToError(error) {
      error.postcssNode = this;
      if (error.stack && this.source && /\n\s{4}at /.test(error.stack)) {
        let s = this.source;
        error.stack = error.stack.replace(
          /\n\s{4}at /,
          `$&${s.input.from}:${s.start.line}:${s.start.column}$&`
        );
      }
      return error;
    }
    after(add) {
      this.parent.insertAfter(this, add);
      return this;
    }
    assign(overrides = {}) {
      for (let name in overrides) {
        this[name] = overrides[name];
      }
      return this;
    }
    before(add) {
      this.parent.insertBefore(this, add);
      return this;
    }
    cleanRaws(keepBetween) {
      delete this.raws.before;
      delete this.raws.after;
      if (!keepBetween) delete this.raws.between;
    }
    clone(overrides = {}) {
      let cloned = cloneNode(this);
      for (let name in overrides) {
        cloned[name] = overrides[name];
      }
      return cloned;
    }
    cloneAfter(overrides = {}) {
      let cloned = this.clone(overrides);
      this.parent.insertAfter(this, cloned);
      return cloned;
    }
    cloneBefore(overrides = {}) {
      let cloned = this.clone(overrides);
      this.parent.insertBefore(this, cloned);
      return cloned;
    }
    error(message, opts = {}) {
      if (this.source) {
        let { end, start } = this.rangeBy(opts);
        return this.source.input.error(
          message,
          { column: start.column, line: start.line },
          { column: end.column, line: end.line },
          opts
        );
      }
      return new CssSyntaxError(message);
    }
    getProxyProcessor() {
      return {
        get(node2, prop) {
          if (prop === "proxyOf") {
            return node2;
          } else if (prop === "root") {
            return () => node2.root().toProxy();
          } else {
            return node2[prop];
          }
        },
        set(node2, prop, value) {
          if (node2[prop] === value) return true;
          node2[prop] = value;
          if (prop === "prop" || prop === "value" || prop === "name" || prop === "params" || prop === "important" || /* c8 ignore next */
          prop === "text") {
            node2.markDirty();
          }
          return true;
        }
      };
    }
    /* c8 ignore next 3 */
    markClean() {
      this[isClean] = true;
    }
    markDirty() {
      if (this[isClean]) {
        this[isClean] = false;
        let next = this;
        while (next = next.parent) {
          next[isClean] = false;
        }
      }
    }
    next() {
      if (!this.parent) return void 0;
      let index = this.parent.index(this);
      return this.parent.nodes[index + 1];
    }
    positionBy(opts) {
      let pos = this.source.start;
      if (opts.index) {
        pos = this.positionInside(opts.index);
      } else if (opts.word) {
        let inputString = "document" in this.source.input ? this.source.input.document : this.source.input.css;
        let stringRepresentation = inputString.slice(
          sourceOffset(inputString, this.source.start),
          sourceOffset(inputString, this.source.end)
        );
        let index = stringRepresentation.indexOf(opts.word);
        if (index !== -1) pos = this.positionInside(index);
      }
      return pos;
    }
    positionInside(index) {
      let column = this.source.start.column;
      let line = this.source.start.line;
      let inputString = "document" in this.source.input ? this.source.input.document : this.source.input.css;
      let offset = sourceOffset(inputString, this.source.start);
      let end = offset + index;
      for (let i = offset; i < end; i++) {
        if (inputString[i] === "\n") {
          column = 1;
          line += 1;
        } else {
          column += 1;
        }
      }
      return { column, line };
    }
    prev() {
      if (!this.parent) return void 0;
      let index = this.parent.index(this);
      return this.parent.nodes[index - 1];
    }
    rangeBy(opts) {
      let start = {
        column: this.source.start.column,
        line: this.source.start.line
      };
      let end = this.source.end ? {
        column: this.source.end.column + 1,
        line: this.source.end.line
      } : {
        column: start.column + 1,
        line: start.line
      };
      if (opts.word) {
        let inputString = "document" in this.source.input ? this.source.input.document : this.source.input.css;
        let stringRepresentation = inputString.slice(
          sourceOffset(inputString, this.source.start),
          sourceOffset(inputString, this.source.end)
        );
        let index = stringRepresentation.indexOf(opts.word);
        if (index !== -1) {
          start = this.positionInside(index);
          end = this.positionInside(
            index + opts.word.length
          );
        }
      } else {
        if (opts.start) {
          start = {
            column: opts.start.column,
            line: opts.start.line
          };
        } else if (opts.index) {
          start = this.positionInside(opts.index);
        }
        if (opts.end) {
          end = {
            column: opts.end.column,
            line: opts.end.line
          };
        } else if (typeof opts.endIndex === "number") {
          end = this.positionInside(opts.endIndex);
        } else if (opts.index) {
          end = this.positionInside(opts.index + 1);
        }
      }
      if (end.line < start.line || end.line === start.line && end.column <= start.column) {
        end = { column: start.column + 1, line: start.line };
      }
      return { end, start };
    }
    raw(prop, defaultType) {
      let str = new Stringifier();
      return str.raw(this, prop, defaultType);
    }
    remove() {
      if (this.parent) {
        this.parent.removeChild(this);
      }
      this.parent = void 0;
      return this;
    }
    replaceWith(...nodes) {
      if (this.parent) {
        let bookmark = this;
        let foundSelf = false;
        for (let node2 of nodes) {
          if (node2 === this) {
            foundSelf = true;
          } else if (foundSelf) {
            this.parent.insertAfter(bookmark, node2);
            bookmark = node2;
          } else {
            this.parent.insertBefore(bookmark, node2);
          }
        }
        if (!foundSelf) {
          this.remove();
        }
      }
      return this;
    }
    root() {
      let result2 = this;
      while (result2.parent && result2.parent.type !== "document") {
        result2 = result2.parent;
      }
      return result2;
    }
    toJSON(_, inputs) {
      let fixed = {};
      let emitInputs = inputs == null;
      inputs = inputs || /* @__PURE__ */ new Map();
      let inputsNextIndex = 0;
      for (let name in this) {
        if (!Object.prototype.hasOwnProperty.call(this, name)) {
          continue;
        }
        if (name === "parent" || name === "proxyCache") continue;
        let value = this[name];
        if (Array.isArray(value)) {
          fixed[name] = value.map((i) => {
            if (typeof i === "object" && i.toJSON) {
              return i.toJSON(null, inputs);
            } else {
              return i;
            }
          });
        } else if (typeof value === "object" && value.toJSON) {
          fixed[name] = value.toJSON(null, inputs);
        } else if (name === "source") {
          let inputId = inputs.get(value.input);
          if (inputId == null) {
            inputId = inputsNextIndex;
            inputs.set(value.input, inputsNextIndex);
            inputsNextIndex++;
          }
          fixed[name] = {
            end: value.end,
            inputId,
            start: value.start
          };
        } else {
          fixed[name] = value;
        }
      }
      if (emitInputs) {
        fixed.inputs = [...inputs.keys()].map((input2) => input2.toJSON());
      }
      return fixed;
    }
    toProxy() {
      if (!this.proxyCache) {
        this.proxyCache = new Proxy(this, this.getProxyProcessor());
      }
      return this.proxyCache;
    }
    toString(stringifier2 = stringify) {
      if (stringifier2.stringify) stringifier2 = stringifier2.stringify;
      let result2 = "";
      stringifier2(this, (i) => {
        result2 += i;
      });
      return result2;
    }
    warn(result2, text, opts) {
      let data = { node: this };
      for (let i in opts) data[i] = opts[i];
      return result2.warn(text, data);
    }
  }
  node$1 = Node;
  Node.default = Node;
  return node$1;
}
var comment$1;
var hasRequiredComment$1;
function requireComment$1() {
  if (hasRequiredComment$1) return comment$1;
  hasRequiredComment$1 = 1;
  let Node = requireNode$1();
  class Comment extends Node {
    constructor(defaults) {
      super(defaults);
      this.type = "comment";
    }
  }
  comment$1 = Comment;
  Comment.default = Comment;
  return comment$1;
}
var declaration;
var hasRequiredDeclaration;
function requireDeclaration() {
  if (hasRequiredDeclaration) return declaration;
  hasRequiredDeclaration = 1;
  let Node = requireNode$1();
  class Declaration extends Node {
    get variable() {
      return this.prop.startsWith("--") || this.prop[0] === "$";
    }
    constructor(defaults) {
      if (defaults && typeof defaults.value !== "undefined" && typeof defaults.value !== "string") {
        defaults = { ...defaults, value: String(defaults.value) };
      }
      super(defaults);
      this.type = "decl";
    }
  }
  declaration = Declaration;
  Declaration.default = Declaration;
  return declaration;
}
var container$1;
var hasRequiredContainer$1;
function requireContainer$1() {
  if (hasRequiredContainer$1) return container$1;
  hasRequiredContainer$1 = 1;
  let Comment = requireComment$1();
  let Declaration = requireDeclaration();
  let Node = requireNode$1();
  let { isClean, my } = requireSymbols();
  let AtRule, parse2, Root, Rule;
  function cleanSource(nodes) {
    return nodes.map((i) => {
      if (i.nodes) i.nodes = cleanSource(i.nodes);
      delete i.source;
      return i;
    });
  }
  function markTreeDirty(node2) {
    node2[isClean] = false;
    if (node2.proxyOf.nodes) {
      for (let i of node2.proxyOf.nodes) {
        markTreeDirty(i);
      }
    }
  }
  class Container extends Node {
    get first() {
      if (!this.proxyOf.nodes) return void 0;
      return this.proxyOf.nodes[0];
    }
    get last() {
      if (!this.proxyOf.nodes) return void 0;
      return this.proxyOf.nodes[this.proxyOf.nodes.length - 1];
    }
    append(...children) {
      for (let child of children) {
        let nodes = this.normalize(child, this.last);
        for (let node2 of nodes) this.proxyOf.nodes.push(node2);
      }
      this.markDirty();
      return this;
    }
    cleanRaws(keepBetween) {
      super.cleanRaws(keepBetween);
      if (this.nodes) {
        for (let node2 of this.nodes) node2.cleanRaws(keepBetween);
      }
    }
    each(callback) {
      if (!this.proxyOf.nodes) return void 0;
      let iterator = this.getIterator();
      let index, result2;
      while (this.indexes[iterator] < this.proxyOf.nodes.length) {
        index = this.indexes[iterator];
        result2 = callback(this.proxyOf.nodes[index], index);
        if (result2 === false) break;
        this.indexes[iterator] += 1;
      }
      delete this.indexes[iterator];
      return result2;
    }
    every(condition) {
      return this.nodes.every(condition);
    }
    getIterator() {
      if (!this.lastEach) this.lastEach = 0;
      if (!this.indexes) this.indexes = {};
      this.lastEach += 1;
      let iterator = this.lastEach;
      this.indexes[iterator] = 0;
      return iterator;
    }
    getProxyProcessor() {
      return {
        get(node2, prop) {
          if (prop === "proxyOf") {
            return node2;
          } else if (!node2[prop]) {
            return node2[prop];
          } else if (prop === "each" || typeof prop === "string" && prop.startsWith("walk")) {
            return (...args) => {
              return node2[prop](
                ...args.map((i) => {
                  if (typeof i === "function") {
                    return (child, index) => i(child.toProxy(), index);
                  } else {
                    return i;
                  }
                })
              );
            };
          } else if (prop === "every" || prop === "some") {
            return (cb) => {
              return node2[prop](
                (child, ...other) => cb(child.toProxy(), ...other)
              );
            };
          } else if (prop === "root") {
            return () => node2.root().toProxy();
          } else if (prop === "nodes") {
            return node2.nodes.map((i) => i.toProxy());
          } else if (prop === "first" || prop === "last") {
            return node2[prop].toProxy();
          } else {
            return node2[prop];
          }
        },
        set(node2, prop, value) {
          if (node2[prop] === value) return true;
          node2[prop] = value;
          if (prop === "name" || prop === "params" || prop === "selector") {
            node2.markDirty();
          }
          return true;
        }
      };
    }
    index(child) {
      if (typeof child === "number") return child;
      if (child.proxyOf) child = child.proxyOf;
      return this.proxyOf.nodes.indexOf(child);
    }
    insertAfter(exist, add) {
      let existIndex = this.index(exist);
      let nodes = this.normalize(add, this.proxyOf.nodes[existIndex]).reverse();
      existIndex = this.index(exist);
      for (let node2 of nodes) this.proxyOf.nodes.splice(existIndex + 1, 0, node2);
      let index;
      for (let id2 in this.indexes) {
        index = this.indexes[id2];
        if (existIndex < index) {
          this.indexes[id2] = index + nodes.length;
        }
      }
      this.markDirty();
      return this;
    }
    insertBefore(exist, add) {
      let existIndex = this.index(exist);
      let type = existIndex === 0 ? "prepend" : false;
      let nodes = this.normalize(
        add,
        this.proxyOf.nodes[existIndex],
        type
      ).reverse();
      existIndex = this.index(exist);
      for (let node2 of nodes) this.proxyOf.nodes.splice(existIndex, 0, node2);
      let index;
      for (let id2 in this.indexes) {
        index = this.indexes[id2];
        if (existIndex <= index) {
          this.indexes[id2] = index + nodes.length;
        }
      }
      this.markDirty();
      return this;
    }
    normalize(nodes, sample) {
      if (typeof nodes === "string") {
        nodes = cleanSource(parse2(nodes).nodes);
      } else if (typeof nodes === "undefined") {
        nodes = [];
      } else if (Array.isArray(nodes)) {
        nodes = nodes.slice(0);
        for (let i of nodes) {
          if (i.parent) i.parent.removeChild(i, "ignore");
        }
      } else if (nodes.type === "root" && this.type !== "document") {
        nodes = nodes.nodes.slice(0);
        for (let i of nodes) {
          if (i.parent) i.parent.removeChild(i, "ignore");
        }
      } else if (nodes.type) {
        nodes = [nodes];
      } else if (nodes.prop) {
        if (typeof nodes.value === "undefined") {
          throw new Error("Value field is missed in node creation");
        } else if (typeof nodes.value !== "string") {
          nodes.value = String(nodes.value);
        }
        nodes = [new Declaration(nodes)];
      } else if (nodes.selector || nodes.selectors) {
        nodes = [new Rule(nodes)];
      } else if (nodes.name) {
        nodes = [new AtRule(nodes)];
      } else if (nodes.text) {
        nodes = [new Comment(nodes)];
      } else {
        throw new Error("Unknown node type in node creation");
      }
      let processed = nodes.map((i) => {
        if (!i[my]) Container.rebuild(i);
        i = i.proxyOf;
        if (i.parent) i.parent.removeChild(i);
        if (i[isClean]) markTreeDirty(i);
        if (!i.raws) i.raws = {};
        if (typeof i.raws.before === "undefined") {
          if (sample && typeof sample.raws.before !== "undefined") {
            i.raws.before = sample.raws.before.replace(/\S/g, "");
          }
        }
        i.parent = this.proxyOf;
        return i;
      });
      return processed;
    }
    prepend(...children) {
      children = children.reverse();
      for (let child of children) {
        let nodes = this.normalize(child, this.first, "prepend").reverse();
        for (let node2 of nodes) this.proxyOf.nodes.unshift(node2);
        for (let id2 in this.indexes) {
          this.indexes[id2] = this.indexes[id2] + nodes.length;
        }
      }
      this.markDirty();
      return this;
    }
    push(child) {
      child.parent = this;
      this.proxyOf.nodes.push(child);
      return this;
    }
    removeAll() {
      for (let node2 of this.proxyOf.nodes) node2.parent = void 0;
      this.proxyOf.nodes = [];
      this.markDirty();
      return this;
    }
    removeChild(child) {
      child = this.index(child);
      this.proxyOf.nodes[child].parent = void 0;
      this.proxyOf.nodes.splice(child, 1);
      let index;
      for (let id2 in this.indexes) {
        index = this.indexes[id2];
        if (index >= child) {
          this.indexes[id2] = index - 1;
        }
      }
      this.markDirty();
      return this;
    }
    replaceValues(pattern, opts, callback) {
      if (!callback) {
        callback = opts;
        opts = {};
      }
      this.walkDecls((decl) => {
        if (opts.props && !opts.props.includes(decl.prop)) return;
        if (opts.fast && !decl.value.includes(opts.fast)) return;
        decl.value = decl.value.replace(pattern, callback);
      });
      this.markDirty();
      return this;
    }
    some(condition) {
      return this.nodes.some(condition);
    }
    walk(callback) {
      return this.each((child, i) => {
        let result2;
        try {
          result2 = callback(child, i);
        } catch (e2) {
          throw child.addToError(e2);
        }
        if (result2 !== false && child.walk) {
          result2 = child.walk(callback);
        }
        return result2;
      });
    }
    walkAtRules(name, callback) {
      if (!callback) {
        callback = name;
        return this.walk((child, i) => {
          if (child.type === "atrule") {
            return callback(child, i);
          }
        });
      }
      if (name instanceof RegExp) {
        return this.walk((child, i) => {
          if (child.type === "atrule" && name.test(child.name)) {
            return callback(child, i);
          }
        });
      }
      return this.walk((child, i) => {
        if (child.type === "atrule" && child.name === name) {
          return callback(child, i);
        }
      });
    }
    walkComments(callback) {
      return this.walk((child, i) => {
        if (child.type === "comment") {
          return callback(child, i);
        }
      });
    }
    walkDecls(prop, callback) {
      if (!callback) {
        callback = prop;
        return this.walk((child, i) => {
          if (child.type === "decl") {
            return callback(child, i);
          }
        });
      }
      if (prop instanceof RegExp) {
        return this.walk((child, i) => {
          if (child.type === "decl" && prop.test(child.prop)) {
            return callback(child, i);
          }
        });
      }
      return this.walk((child, i) => {
        if (child.type === "decl" && child.prop === prop) {
          return callback(child, i);
        }
      });
    }
    walkRules(selector2, callback) {
      if (!callback) {
        callback = selector2;
        return this.walk((child, i) => {
          if (child.type === "rule") {
            return callback(child, i);
          }
        });
      }
      if (selector2 instanceof RegExp) {
        return this.walk((child, i) => {
          if (child.type === "rule" && selector2.test(child.selector)) {
            return callback(child, i);
          }
        });
      }
      return this.walk((child, i) => {
        if (child.type === "rule" && child.selector === selector2) {
          return callback(child, i);
        }
      });
    }
  }
  Container.registerParse = (dependant) => {
    parse2 = dependant;
  };
  Container.registerRule = (dependant) => {
    Rule = dependant;
  };
  Container.registerAtRule = (dependant) => {
    AtRule = dependant;
  };
  Container.registerRoot = (dependant) => {
    Root = dependant;
  };
  container$1 = Container;
  Container.default = Container;
  Container.rebuild = (node2) => {
    if (node2.type === "atrule") {
      Object.setPrototypeOf(node2, AtRule.prototype);
    } else if (node2.type === "rule") {
      Object.setPrototypeOf(node2, Rule.prototype);
    } else if (node2.type === "decl") {
      Object.setPrototypeOf(node2, Declaration.prototype);
    } else if (node2.type === "comment") {
      Object.setPrototypeOf(node2, Comment.prototype);
    } else if (node2.type === "root") {
      Object.setPrototypeOf(node2, Root.prototype);
    }
    node2[my] = true;
    if (node2.nodes) {
      node2.nodes.forEach((child) => {
        Container.rebuild(child);
      });
    }
  };
  return container$1;
}
var atRule;
var hasRequiredAtRule;
function requireAtRule() {
  if (hasRequiredAtRule) return atRule;
  hasRequiredAtRule = 1;
  let Container = requireContainer$1();
  class AtRule extends Container {
    constructor(defaults) {
      super(defaults);
      this.type = "atrule";
    }
    append(...children) {
      if (!this.proxyOf.nodes) this.nodes = [];
      return super.append(...children);
    }
    prepend(...children) {
      if (!this.proxyOf.nodes) this.nodes = [];
      return super.prepend(...children);
    }
  }
  atRule = AtRule;
  AtRule.default = AtRule;
  Container.registerAtRule(AtRule);
  return atRule;
}
var document$1;
var hasRequiredDocument;
function requireDocument() {
  if (hasRequiredDocument) return document$1;
  hasRequiredDocument = 1;
  let Container = requireContainer$1();
  let LazyResult, Processor;
  class Document extends Container {
    constructor(defaults) {
      super({ type: "document", ...defaults });
      if (!this.nodes) {
        this.nodes = [];
      }
    }
    toResult(opts = {}) {
      let lazy = new LazyResult(new Processor(), this, opts);
      return lazy.stringify();
    }
  }
  Document.registerLazyResult = (dependant) => {
    LazyResult = dependant;
  };
  Document.registerProcessor = (dependant) => {
    Processor = dependant;
  };
  document$1 = Document;
  Document.default = Document;
  return document$1;
}
var nonSecure;
var hasRequiredNonSecure;
function requireNonSecure() {
  if (hasRequiredNonSecure) return nonSecure;
  hasRequiredNonSecure = 1;
  let urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
  let customAlphabet = (alphabet, defaultSize = 21) => {
    return (size = defaultSize) => {
      let id2 = "";
      let i = size | 0;
      while (i--) {
        id2 += alphabet[Math.random() * alphabet.length | 0];
      }
      return id2;
    };
  };
  let nanoid = (size = 21) => {
    let id2 = "";
    let i = size | 0;
    while (i--) {
      id2 += urlAlphabet[Math.random() * 64 | 0];
    }
    return id2;
  };
  nonSecure = { nanoid, customAlphabet };
  return nonSecure;
}
var previousMap;
var hasRequiredPreviousMap;
function requirePreviousMap() {
  if (hasRequiredPreviousMap) return previousMap;
  hasRequiredPreviousMap = 1;
  let { existsSync, readFileSync } = require$$2;
  let { dirname, join } = require$$2;
  let { SourceMapConsumer, SourceMapGenerator } = require$$2;
  function fromBase64(str) {
    if (Buffer) {
      return Buffer.from(str, "base64").toString();
    } else {
      return window.atob(str);
    }
  }
  class PreviousMap {
    constructor(css, opts) {
      if (opts.map === false) return;
      this.loadAnnotation(css);
      this.inline = this.startWith(this.annotation, "data:");
      let prev = opts.map ? opts.map.prev : void 0;
      let text = this.loadMap(opts.from, prev);
      if (!this.mapFile && opts.from) {
        this.mapFile = opts.from;
      }
      if (this.mapFile) this.root = dirname(this.mapFile);
      if (text) this.text = text;
    }
    consumer() {
      if (!this.consumerCache) {
        this.consumerCache = new SourceMapConsumer(this.text);
      }
      return this.consumerCache;
    }
    decodeInline(text) {
      let baseCharsetUri = /^data:application\/json;charset=utf-?8;base64,/;
      let baseUri = /^data:application\/json;base64,/;
      let charsetUri = /^data:application\/json;charset=utf-?8,/;
      let uri = /^data:application\/json,/;
      let uriMatch = text.match(charsetUri) || text.match(uri);
      if (uriMatch) {
        return decodeURIComponent(text.substr(uriMatch[0].length));
      }
      let baseUriMatch = text.match(baseCharsetUri) || text.match(baseUri);
      if (baseUriMatch) {
        return fromBase64(text.substr(baseUriMatch[0].length));
      }
      let encoding = text.match(/data:application\/json;([^,]+),/)[1];
      throw new Error("Unsupported source map encoding " + encoding);
    }
    getAnnotationURL(sourceMapString) {
      return sourceMapString.replace(/^\/\*\s*# sourceMappingURL=/, "").trim();
    }
    isMap(map) {
      if (typeof map !== "object") return false;
      return typeof map.mappings === "string" || typeof map._mappings === "string" || Array.isArray(map.sections);
    }
    loadAnnotation(css) {
      let comments = css.match(/\/\*\s*# sourceMappingURL=/g);
      if (!comments) return;
      let start = css.lastIndexOf(comments.pop());
      let end = css.indexOf("*/", start);
      if (start > -1 && end > -1) {
        this.annotation = this.getAnnotationURL(css.substring(start, end));
      }
    }
    loadFile(path) {
      this.root = dirname(path);
      if (existsSync(path)) {
        this.mapFile = path;
        return readFileSync(path, "utf-8").toString().trim();
      }
    }
    loadMap(file, prev) {
      if (prev === false) return false;
      if (prev) {
        if (typeof prev === "string") {
          return prev;
        } else if (typeof prev === "function") {
          let prevPath = prev(file);
          if (prevPath) {
            let map = this.loadFile(prevPath);
            if (!map) {
              throw new Error(
                "Unable to load previous source map: " + prevPath.toString()
              );
            }
            return map;
          }
        } else if (prev instanceof SourceMapConsumer) {
          return SourceMapGenerator.fromSourceMap(prev).toString();
        } else if (prev instanceof SourceMapGenerator) {
          return prev.toString();
        } else if (this.isMap(prev)) {
          return JSON.stringify(prev);
        } else {
          throw new Error(
            "Unsupported previous source map format: " + prev.toString()
          );
        }
      } else if (this.inline) {
        return this.decodeInline(this.annotation);
      } else if (this.annotation) {
        let map = this.annotation;
        if (file) map = join(dirname(file), map);
        return this.loadFile(map);
      }
    }
    startWith(string2, start) {
      if (!string2) return false;
      return string2.substr(0, start.length) === start;
    }
    withContent() {
      return !!(this.consumer().sourcesContent && this.consumer().sourcesContent.length > 0);
    }
  }
  previousMap = PreviousMap;
  PreviousMap.default = PreviousMap;
  return previousMap;
}
var input;
var hasRequiredInput;
function requireInput() {
  if (hasRequiredInput) return input;
  hasRequiredInput = 1;
  let { nanoid } = /* @__PURE__ */ requireNonSecure();
  let { isAbsolute, resolve } = require$$2;
  let { SourceMapConsumer, SourceMapGenerator } = require$$2;
  let { fileURLToPath, pathToFileURL } = require$$2;
  let CssSyntaxError = requireCssSyntaxError();
  let PreviousMap = requirePreviousMap();
  let terminalHighlight = require$$2;
  let fromOffsetCache = Symbol("fromOffsetCache");
  let sourceMapAvailable = Boolean(SourceMapConsumer && SourceMapGenerator);
  let pathAvailable = Boolean(resolve && isAbsolute);
  class Input {
    get from() {
      return this.file || this.id;
    }
    constructor(css, opts = {}) {
      if (css === null || typeof css === "undefined" || typeof css === "object" && !css.toString) {
        throw new Error(`PostCSS received ${css} instead of CSS string`);
      }
      this.css = css.toString();
      if (this.css[0] === "\uFEFF" || this.css[0] === "￾") {
        this.hasBOM = true;
        this.css = this.css.slice(1);
      } else {
        this.hasBOM = false;
      }
      this.document = this.css;
      if (opts.document) this.document = opts.document.toString();
      if (opts.from) {
        if (!pathAvailable || /^\w+:\/\//.test(opts.from) || isAbsolute(opts.from)) {
          this.file = opts.from;
        } else {
          this.file = resolve(opts.from);
        }
      }
      if (pathAvailable && sourceMapAvailable) {
        let map = new PreviousMap(this.css, opts);
        if (map.text) {
          this.map = map;
          let file = map.consumer().file;
          if (!this.file && file) this.file = this.mapResolve(file);
        }
      }
      if (!this.file) {
        this.id = "<input css " + nanoid(6) + ">";
      }
      if (this.map) this.map.file = this.from;
    }
    error(message, line, column, opts = {}) {
      let endColumn, endLine, result2;
      if (line && typeof line === "object") {
        let start = line;
        let end = column;
        if (typeof start.offset === "number") {
          let pos = this.fromOffset(start.offset);
          line = pos.line;
          column = pos.col;
        } else {
          line = start.line;
          column = start.column;
        }
        if (typeof end.offset === "number") {
          let pos = this.fromOffset(end.offset);
          endLine = pos.line;
          endColumn = pos.col;
        } else {
          endLine = end.line;
          endColumn = end.column;
        }
      } else if (!column) {
        let pos = this.fromOffset(line);
        line = pos.line;
        column = pos.col;
      }
      let origin = this.origin(line, column, endLine, endColumn);
      if (origin) {
        result2 = new CssSyntaxError(
          message,
          origin.endLine === void 0 ? origin.line : { column: origin.column, line: origin.line },
          origin.endLine === void 0 ? origin.column : { column: origin.endColumn, line: origin.endLine },
          origin.source,
          origin.file,
          opts.plugin
        );
      } else {
        result2 = new CssSyntaxError(
          message,
          endLine === void 0 ? line : { column, line },
          endLine === void 0 ? column : { column: endColumn, line: endLine },
          this.css,
          this.file,
          opts.plugin
        );
      }
      result2.input = { column, endColumn, endLine, line, source: this.css };
      if (this.file) {
        if (pathToFileURL) {
          result2.input.url = pathToFileURL(this.file).toString();
        }
        result2.input.file = this.file;
      }
      return result2;
    }
    fromOffset(offset) {
      let lastLine, lineToIndex;
      if (!this[fromOffsetCache]) {
        let lines = this.css.split("\n");
        lineToIndex = new Array(lines.length);
        let prevIndex = 0;
        for (let i = 0, l2 = lines.length; i < l2; i++) {
          lineToIndex[i] = prevIndex;
          prevIndex += lines[i].length + 1;
        }
        this[fromOffsetCache] = lineToIndex;
      } else {
        lineToIndex = this[fromOffsetCache];
      }
      lastLine = lineToIndex[lineToIndex.length - 1];
      let min = 0;
      if (offset >= lastLine) {
        min = lineToIndex.length - 1;
      } else {
        let max = lineToIndex.length - 2;
        let mid;
        while (min < max) {
          mid = min + (max - min >> 1);
          if (offset < lineToIndex[mid]) {
            max = mid - 1;
          } else if (offset >= lineToIndex[mid + 1]) {
            min = mid + 1;
          } else {
            min = mid;
            break;
          }
        }
      }
      return {
        col: offset - lineToIndex[min] + 1,
        line: min + 1
      };
    }
    mapResolve(file) {
      if (/^\w+:\/\//.test(file)) {
        return file;
      }
      return resolve(this.map.consumer().sourceRoot || this.map.root || ".", file);
    }
    origin(line, column, endLine, endColumn) {
      if (!this.map) return false;
      let consumer = this.map.consumer();
      let from = consumer.originalPositionFor({ column, line });
      if (!from.source) return false;
      let to;
      if (typeof endLine === "number") {
        to = consumer.originalPositionFor({ column: endColumn, line: endLine });
      }
      let fromUrl;
      if (isAbsolute(from.source)) {
        fromUrl = pathToFileURL(from.source);
      } else {
        fromUrl = new URL(
          from.source,
          this.map.consumer().sourceRoot || pathToFileURL(this.map.mapFile)
        );
      }
      let result2 = {
        column: from.column,
        endColumn: to && to.column,
        endLine: to && to.line,
        line: from.line,
        url: fromUrl.toString()
      };
      if (fromUrl.protocol === "file:") {
        if (fileURLToPath) {
          result2.file = fileURLToPath(fromUrl);
        } else {
          throw new Error(`file: protocol is not available in this PostCSS build`);
        }
      }
      let source = consumer.sourceContentFor(from.source);
      if (source) result2.source = source;
      return result2;
    }
    toJSON() {
      let json = {};
      for (let name of ["hasBOM", "css", "file", "id"]) {
        if (this[name] != null) {
          json[name] = this[name];
        }
      }
      if (this.map) {
        json.map = { ...this.map };
        if (json.map.consumerCache) {
          json.map.consumerCache = void 0;
        }
      }
      return json;
    }
  }
  input = Input;
  Input.default = Input;
  if (terminalHighlight && terminalHighlight.registerInput) {
    terminalHighlight.registerInput(Input);
  }
  return input;
}
var root$1;
var hasRequiredRoot$1;
function requireRoot$1() {
  if (hasRequiredRoot$1) return root$1;
  hasRequiredRoot$1 = 1;
  let Container = requireContainer$1();
  let LazyResult, Processor;
  class Root extends Container {
    constructor(defaults) {
      super(defaults);
      this.type = "root";
      if (!this.nodes) this.nodes = [];
    }
    normalize(child, sample, type) {
      let nodes = super.normalize(child);
      if (sample) {
        if (type === "prepend") {
          if (this.nodes.length > 1) {
            sample.raws.before = this.nodes[1].raws.before;
          } else {
            delete sample.raws.before;
          }
        } else if (this.first !== sample) {
          for (let node2 of nodes) {
            node2.raws.before = sample.raws.before;
          }
        }
      }
      return nodes;
    }
    removeChild(child, ignore) {
      let index = this.index(child);
      if (!ignore && index === 0 && this.nodes.length > 1) {
        this.nodes[1].raws.before = this.nodes[index].raws.before;
      }
      return super.removeChild(child);
    }
    toResult(opts = {}) {
      let lazy = new LazyResult(new Processor(), this, opts);
      return lazy.stringify();
    }
  }
  Root.registerLazyResult = (dependant) => {
    LazyResult = dependant;
  };
  Root.registerProcessor = (dependant) => {
    Processor = dependant;
  };
  root$1 = Root;
  Root.default = Root;
  Container.registerRoot(Root);
  return root$1;
}
var list_1;
var hasRequiredList;
function requireList() {
  if (hasRequiredList) return list_1;
  hasRequiredList = 1;
  let list = {
    comma(string2) {
      return list.split(string2, [","], true);
    },
    space(string2) {
      let spaces = [" ", "\n", "	"];
      return list.split(string2, spaces);
    },
    split(string2, separators, last) {
      let array = [];
      let current = "";
      let split = false;
      let func = 0;
      let inQuote = false;
      let prevQuote = "";
      let escape = false;
      for (let letter of string2) {
        if (escape) {
          escape = false;
        } else if (letter === "\\") {
          escape = true;
        } else if (inQuote) {
          if (letter === prevQuote) {
            inQuote = false;
          }
        } else if (letter === '"' || letter === "'") {
          inQuote = true;
          prevQuote = letter;
        } else if (letter === "(") {
          func += 1;
        } else if (letter === ")") {
          if (func > 0) func -= 1;
        } else if (func === 0) {
          if (separators.includes(letter)) split = true;
        }
        if (split) {
          if (current !== "") array.push(current.trim());
          current = "";
          split = false;
        } else {
          current += letter;
        }
      }
      if (last || current !== "") array.push(current.trim());
      return array;
    }
  };
  list_1 = list;
  list.default = list;
  return list_1;
}
var rule;
var hasRequiredRule;
function requireRule() {
  if (hasRequiredRule) return rule;
  hasRequiredRule = 1;
  let Container = requireContainer$1();
  let list = requireList();
  class Rule extends Container {
    get selectors() {
      return list.comma(this.selector);
    }
    set selectors(values) {
      let match = this.selector ? this.selector.match(/,\s*/) : null;
      let sep = match ? match[0] : "," + this.raw("between", "beforeOpen");
      this.selector = values.join(sep);
    }
    constructor(defaults) {
      super(defaults);
      this.type = "rule";
      if (!this.nodes) this.nodes = [];
    }
  }
  rule = Rule;
  Rule.default = Rule;
  Container.registerRule(Rule);
  return rule;
}
var fromJSON_1;
var hasRequiredFromJSON;
function requireFromJSON() {
  if (hasRequiredFromJSON) return fromJSON_1;
  hasRequiredFromJSON = 1;
  let AtRule = requireAtRule();
  let Comment = requireComment$1();
  let Declaration = requireDeclaration();
  let Input = requireInput();
  let PreviousMap = requirePreviousMap();
  let Root = requireRoot$1();
  let Rule = requireRule();
  function fromJSON(json, inputs) {
    if (Array.isArray(json)) return json.map((n) => fromJSON(n));
    let { inputs: ownInputs, ...defaults } = json;
    if (ownInputs) {
      inputs = [];
      for (let input2 of ownInputs) {
        let inputHydrated = { ...input2, __proto__: Input.prototype };
        if (inputHydrated.map) {
          inputHydrated.map = {
            ...inputHydrated.map,
            __proto__: PreviousMap.prototype
          };
        }
        inputs.push(inputHydrated);
      }
    }
    if (defaults.nodes) {
      defaults.nodes = json.nodes.map((n) => fromJSON(n, inputs));
    }
    if (defaults.source) {
      let { inputId, ...source } = defaults.source;
      defaults.source = source;
      if (inputId != null) {
        defaults.source.input = inputs[inputId];
      }
    }
    if (defaults.type === "root") {
      return new Root(defaults);
    } else if (defaults.type === "decl") {
      return new Declaration(defaults);
    } else if (defaults.type === "rule") {
      return new Rule(defaults);
    } else if (defaults.type === "comment") {
      return new Comment(defaults);
    } else if (defaults.type === "atrule") {
      return new AtRule(defaults);
    } else {
      throw new Error("Unknown node type: " + json.type);
    }
  }
  fromJSON_1 = fromJSON;
  fromJSON.default = fromJSON;
  return fromJSON_1;
}
var mapGenerator;
var hasRequiredMapGenerator;
function requireMapGenerator() {
  if (hasRequiredMapGenerator) return mapGenerator;
  hasRequiredMapGenerator = 1;
  let { dirname, relative, resolve, sep } = require$$2;
  let { SourceMapConsumer, SourceMapGenerator } = require$$2;
  let { pathToFileURL } = require$$2;
  let Input = requireInput();
  let sourceMapAvailable = Boolean(SourceMapConsumer && SourceMapGenerator);
  let pathAvailable = Boolean(dirname && resolve && relative && sep);
  class MapGenerator {
    constructor(stringify, root2, opts, cssString) {
      this.stringify = stringify;
      this.mapOpts = opts.map || {};
      this.root = root2;
      this.opts = opts;
      this.css = cssString;
      this.originalCSS = cssString;
      this.usesFileUrls = !this.mapOpts.from && this.mapOpts.absolute;
      this.memoizedFileURLs = /* @__PURE__ */ new Map();
      this.memoizedPaths = /* @__PURE__ */ new Map();
      this.memoizedURLs = /* @__PURE__ */ new Map();
    }
    addAnnotation() {
      let content;
      if (this.isInline()) {
        content = "data:application/json;base64," + this.toBase64(this.map.toString());
      } else if (typeof this.mapOpts.annotation === "string") {
        content = this.mapOpts.annotation;
      } else if (typeof this.mapOpts.annotation === "function") {
        content = this.mapOpts.annotation(this.opts.to, this.root);
      } else {
        content = this.outputFile() + ".map";
      }
      let eol = "\n";
      if (this.css.includes("\r\n")) eol = "\r\n";
      this.css += eol + "/*# sourceMappingURL=" + content + " */";
    }
    applyPrevMaps() {
      for (let prev of this.previous()) {
        let from = this.toUrl(this.path(prev.file));
        let root2 = prev.root || dirname(prev.file);
        let map;
        if (this.mapOpts.sourcesContent === false) {
          map = new SourceMapConsumer(prev.text);
          if (map.sourcesContent) {
            map.sourcesContent = null;
          }
        } else {
          map = prev.consumer();
        }
        this.map.applySourceMap(map, from, this.toUrl(this.path(root2)));
      }
    }
    clearAnnotation() {
      if (this.mapOpts.annotation === false) return;
      if (this.root) {
        let node2;
        for (let i = this.root.nodes.length - 1; i >= 0; i--) {
          node2 = this.root.nodes[i];
          if (node2.type !== "comment") continue;
          if (node2.text.startsWith("# sourceMappingURL=")) {
            this.root.removeChild(i);
          }
        }
      } else if (this.css) {
        this.css = this.css.replace(/\n*\/\*#[\S\s]*?\*\/$/gm, "");
      }
    }
    generate() {
      this.clearAnnotation();
      if (pathAvailable && sourceMapAvailable && this.isMap()) {
        return this.generateMap();
      } else {
        let result2 = "";
        this.stringify(this.root, (i) => {
          result2 += i;
        });
        return [result2];
      }
    }
    generateMap() {
      if (this.root) {
        this.generateString();
      } else if (this.previous().length === 1) {
        let prev = this.previous()[0].consumer();
        prev.file = this.outputFile();
        this.map = SourceMapGenerator.fromSourceMap(prev, {
          ignoreInvalidMapping: true
        });
      } else {
        this.map = new SourceMapGenerator({
          file: this.outputFile(),
          ignoreInvalidMapping: true
        });
        this.map.addMapping({
          generated: { column: 0, line: 1 },
          original: { column: 0, line: 1 },
          source: this.opts.from ? this.toUrl(this.path(this.opts.from)) : "<no source>"
        });
      }
      if (this.isSourcesContent()) this.setSourcesContent();
      if (this.root && this.previous().length > 0) this.applyPrevMaps();
      if (this.isAnnotation()) this.addAnnotation();
      if (this.isInline()) {
        return [this.css];
      } else {
        return [this.css, this.map];
      }
    }
    generateString() {
      this.css = "";
      this.map = new SourceMapGenerator({
        file: this.outputFile(),
        ignoreInvalidMapping: true
      });
      let line = 1;
      let column = 1;
      let noSource = "<no source>";
      let mapping = {
        generated: { column: 0, line: 0 },
        original: { column: 0, line: 0 },
        source: ""
      };
      let last, lines;
      this.stringify(this.root, (str, node2, type) => {
        this.css += str;
        if (node2 && type !== "end") {
          mapping.generated.line = line;
          mapping.generated.column = column - 1;
          if (node2.source && node2.source.start) {
            mapping.source = this.sourcePath(node2);
            mapping.original.line = node2.source.start.line;
            mapping.original.column = node2.source.start.column - 1;
            this.map.addMapping(mapping);
          } else {
            mapping.source = noSource;
            mapping.original.line = 1;
            mapping.original.column = 0;
            this.map.addMapping(mapping);
          }
        }
        lines = str.match(/\n/g);
        if (lines) {
          line += lines.length;
          last = str.lastIndexOf("\n");
          column = str.length - last;
        } else {
          column += str.length;
        }
        if (node2 && type !== "start") {
          let p = node2.parent || { raws: {} };
          let childless = node2.type === "decl" || node2.type === "atrule" && !node2.nodes;
          if (!childless || node2 !== p.last || p.raws.semicolon) {
            if (node2.source && node2.source.end) {
              mapping.source = this.sourcePath(node2);
              mapping.original.line = node2.source.end.line;
              mapping.original.column = node2.source.end.column - 1;
              mapping.generated.line = line;
              mapping.generated.column = column - 2;
              this.map.addMapping(mapping);
            } else {
              mapping.source = noSource;
              mapping.original.line = 1;
              mapping.original.column = 0;
              mapping.generated.line = line;
              mapping.generated.column = column - 1;
              this.map.addMapping(mapping);
            }
          }
        }
      });
    }
    isAnnotation() {
      if (this.isInline()) {
        return true;
      }
      if (typeof this.mapOpts.annotation !== "undefined") {
        return this.mapOpts.annotation;
      }
      if (this.previous().length) {
        return this.previous().some((i) => i.annotation);
      }
      return true;
    }
    isInline() {
      if (typeof this.mapOpts.inline !== "undefined") {
        return this.mapOpts.inline;
      }
      let annotation = this.mapOpts.annotation;
      if (typeof annotation !== "undefined" && annotation !== true) {
        return false;
      }
      if (this.previous().length) {
        return this.previous().some((i) => i.inline);
      }
      return true;
    }
    isMap() {
      if (typeof this.opts.map !== "undefined") {
        return !!this.opts.map;
      }
      return this.previous().length > 0;
    }
    isSourcesContent() {
      if (typeof this.mapOpts.sourcesContent !== "undefined") {
        return this.mapOpts.sourcesContent;
      }
      if (this.previous().length) {
        return this.previous().some((i) => i.withContent());
      }
      return true;
    }
    outputFile() {
      if (this.opts.to) {
        return this.path(this.opts.to);
      } else if (this.opts.from) {
        return this.path(this.opts.from);
      } else {
        return "to.css";
      }
    }
    path(file) {
      if (this.mapOpts.absolute) return file;
      if (file.charCodeAt(0) === 60) return file;
      if (/^\w+:\/\//.test(file)) return file;
      let cached = this.memoizedPaths.get(file);
      if (cached) return cached;
      let from = this.opts.to ? dirname(this.opts.to) : ".";
      if (typeof this.mapOpts.annotation === "string") {
        from = dirname(resolve(from, this.mapOpts.annotation));
      }
      let path = relative(from, file);
      this.memoizedPaths.set(file, path);
      return path;
    }
    previous() {
      if (!this.previousMaps) {
        this.previousMaps = [];
        if (this.root) {
          this.root.walk((node2) => {
            if (node2.source && node2.source.input.map) {
              let map = node2.source.input.map;
              if (!this.previousMaps.includes(map)) {
                this.previousMaps.push(map);
              }
            }
          });
        } else {
          let input2 = new Input(this.originalCSS, this.opts);
          if (input2.map) this.previousMaps.push(input2.map);
        }
      }
      return this.previousMaps;
    }
    setSourcesContent() {
      let already = {};
      if (this.root) {
        this.root.walk((node2) => {
          if (node2.source) {
            let from = node2.source.input.from;
            if (from && !already[from]) {
              already[from] = true;
              let fromUrl = this.usesFileUrls ? this.toFileUrl(from) : this.toUrl(this.path(from));
              this.map.setSourceContent(fromUrl, node2.source.input.css);
            }
          }
        });
      } else if (this.css) {
        let from = this.opts.from ? this.toUrl(this.path(this.opts.from)) : "<no source>";
        this.map.setSourceContent(from, this.css);
      }
    }
    sourcePath(node2) {
      if (this.mapOpts.from) {
        return this.toUrl(this.mapOpts.from);
      } else if (this.usesFileUrls) {
        return this.toFileUrl(node2.source.input.from);
      } else {
        return this.toUrl(this.path(node2.source.input.from));
      }
    }
    toBase64(str) {
      if (Buffer) {
        return Buffer.from(str).toString("base64");
      } else {
        return window.btoa(unescape(encodeURIComponent(str)));
      }
    }
    toFileUrl(path) {
      let cached = this.memoizedFileURLs.get(path);
      if (cached) return cached;
      if (pathToFileURL) {
        let fileURL = pathToFileURL(path).toString();
        this.memoizedFileURLs.set(path, fileURL);
        return fileURL;
      } else {
        throw new Error(
          "`map.absolute` option is not available in this PostCSS build"
        );
      }
    }
    toUrl(path) {
      let cached = this.memoizedURLs.get(path);
      if (cached) return cached;
      if (sep === "\\") {
        path = path.replace(/\\/g, "/");
      }
      let url = encodeURI(path).replace(/[#?]/g, encodeURIComponent);
      this.memoizedURLs.set(path, url);
      return url;
    }
  }
  mapGenerator = MapGenerator;
  return mapGenerator;
}
var tokenize$1;
var hasRequiredTokenize$1;
function requireTokenize$1() {
  if (hasRequiredTokenize$1) return tokenize$1;
  hasRequiredTokenize$1 = 1;
  const SINGLE_QUOTE = "'".charCodeAt(0);
  const DOUBLE_QUOTE = '"'.charCodeAt(0);
  const BACKSLASH = "\\".charCodeAt(0);
  const SLASH = "/".charCodeAt(0);
  const NEWLINE = "\n".charCodeAt(0);
  const SPACE = " ".charCodeAt(0);
  const FEED = "\f".charCodeAt(0);
  const TAB = "	".charCodeAt(0);
  const CR = "\r".charCodeAt(0);
  const OPEN_SQUARE = "[".charCodeAt(0);
  const CLOSE_SQUARE = "]".charCodeAt(0);
  const OPEN_PARENTHESES = "(".charCodeAt(0);
  const CLOSE_PARENTHESES = ")".charCodeAt(0);
  const OPEN_CURLY = "{".charCodeAt(0);
  const CLOSE_CURLY = "}".charCodeAt(0);
  const SEMICOLON = ";".charCodeAt(0);
  const ASTERISK = "*".charCodeAt(0);
  const COLON = ":".charCodeAt(0);
  const AT = "@".charCodeAt(0);
  const RE_AT_END = /[\t\n\f\r "#'()/;[\\\]{}]/g;
  const RE_WORD_END = /[\t\n\f\r !"#'():;@[\\\]{}]|\/(?=\*)/g;
  const RE_BAD_BRACKET = /.[\r\n"'(/\\]/;
  const RE_HEX_ESCAPE = /[\da-f]/i;
  tokenize$1 = function tokenizer(input2, options = {}) {
    let css = input2.css.valueOf();
    let ignore = options.ignoreErrors;
    let code, content, escape, next, quote;
    let currentToken, escaped, escapePos, n, prev;
    let length = css.length;
    let pos = 0;
    let buffer = [];
    let returned = [];
    function position() {
      return pos;
    }
    function unclosed(what) {
      throw input2.error("Unclosed " + what, pos);
    }
    function endOfFile() {
      return returned.length === 0 && pos >= length;
    }
    function nextToken(opts) {
      if (returned.length) return returned.pop();
      if (pos >= length) return;
      let ignoreUnclosed = opts ? opts.ignoreUnclosed : false;
      code = css.charCodeAt(pos);
      switch (code) {
        case NEWLINE:
        case SPACE:
        case TAB:
        case CR:
        case FEED: {
          next = pos;
          do {
            next += 1;
            code = css.charCodeAt(next);
          } while (code === SPACE || code === NEWLINE || code === TAB || code === CR || code === FEED);
          currentToken = ["space", css.slice(pos, next)];
          pos = next - 1;
          break;
        }
        case OPEN_SQUARE:
        case CLOSE_SQUARE:
        case OPEN_CURLY:
        case CLOSE_CURLY:
        case COLON:
        case SEMICOLON:
        case CLOSE_PARENTHESES: {
          let controlChar = String.fromCharCode(code);
          currentToken = [controlChar, controlChar, pos];
          break;
        }
        case OPEN_PARENTHESES: {
          prev = buffer.length ? buffer.pop()[1] : "";
          n = css.charCodeAt(pos + 1);
          if (prev === "url" && n !== SINGLE_QUOTE && n !== DOUBLE_QUOTE && n !== SPACE && n !== NEWLINE && n !== TAB && n !== FEED && n !== CR) {
            next = pos;
            do {
              escaped = false;
              next = css.indexOf(")", next + 1);
              if (next === -1) {
                if (ignore || ignoreUnclosed) {
                  next = pos;
                  break;
                } else {
                  unclosed("bracket");
                }
              }
              escapePos = next;
              while (css.charCodeAt(escapePos - 1) === BACKSLASH) {
                escapePos -= 1;
                escaped = !escaped;
              }
            } while (escaped);
            currentToken = ["brackets", css.slice(pos, next + 1), pos, next];
            pos = next;
          } else {
            next = css.indexOf(")", pos + 1);
            content = css.slice(pos, next + 1);
            if (next === -1 || RE_BAD_BRACKET.test(content)) {
              currentToken = ["(", "(", pos];
            } else {
              currentToken = ["brackets", content, pos, next];
              pos = next;
            }
          }
          break;
        }
        case SINGLE_QUOTE:
        case DOUBLE_QUOTE: {
          quote = code === SINGLE_QUOTE ? "'" : '"';
          next = pos;
          do {
            escaped = false;
            next = css.indexOf(quote, next + 1);
            if (next === -1) {
              if (ignore || ignoreUnclosed) {
                next = pos + 1;
                break;
              } else {
                unclosed("string");
              }
            }
            escapePos = next;
            while (css.charCodeAt(escapePos - 1) === BACKSLASH) {
              escapePos -= 1;
              escaped = !escaped;
            }
          } while (escaped);
          currentToken = ["string", css.slice(pos, next + 1), pos, next];
          pos = next;
          break;
        }
        case AT: {
          RE_AT_END.lastIndex = pos + 1;
          RE_AT_END.test(css);
          if (RE_AT_END.lastIndex === 0) {
            next = css.length - 1;
          } else {
            next = RE_AT_END.lastIndex - 2;
          }
          currentToken = ["at-word", css.slice(pos, next + 1), pos, next];
          pos = next;
          break;
        }
        case BACKSLASH: {
          next = pos;
          escape = true;
          while (css.charCodeAt(next + 1) === BACKSLASH) {
            next += 1;
            escape = !escape;
          }
          code = css.charCodeAt(next + 1);
          if (escape && code !== SLASH && code !== SPACE && code !== NEWLINE && code !== TAB && code !== CR && code !== FEED) {
            next += 1;
            if (RE_HEX_ESCAPE.test(css.charAt(next))) {
              while (RE_HEX_ESCAPE.test(css.charAt(next + 1))) {
                next += 1;
              }
              if (css.charCodeAt(next + 1) === SPACE) {
                next += 1;
              }
            }
          }
          currentToken = ["word", css.slice(pos, next + 1), pos, next];
          pos = next;
          break;
        }
        default: {
          if (code === SLASH && css.charCodeAt(pos + 1) === ASTERISK) {
            next = css.indexOf("*/", pos + 2) + 1;
            if (next === 0) {
              if (ignore || ignoreUnclosed) {
                next = css.length;
              } else {
                unclosed("comment");
              }
            }
            currentToken = ["comment", css.slice(pos, next + 1), pos, next];
            pos = next;
          } else {
            RE_WORD_END.lastIndex = pos + 1;
            RE_WORD_END.test(css);
            if (RE_WORD_END.lastIndex === 0) {
              next = css.length - 1;
            } else {
              next = RE_WORD_END.lastIndex - 2;
            }
            currentToken = ["word", css.slice(pos, next + 1), pos, next];
            buffer.push(currentToken);
            pos = next;
          }
          break;
        }
      }
      pos++;
      return currentToken;
    }
    function back(token) {
      returned.push(token);
    }
    return {
      back,
      endOfFile,
      nextToken,
      position
    };
  };
  return tokenize$1;
}
var parser$2;
var hasRequiredParser$2;
function requireParser$2() {
  if (hasRequiredParser$2) return parser$2;
  hasRequiredParser$2 = 1;
  let AtRule = requireAtRule();
  let Comment = requireComment$1();
  let Declaration = requireDeclaration();
  let Root = requireRoot$1();
  let Rule = requireRule();
  let tokenizer = requireTokenize$1();
  const SAFE_COMMENT_NEIGHBOR = {
    empty: true,
    space: true
  };
  function findLastWithPosition(tokens) {
    for (let i = tokens.length - 1; i >= 0; i--) {
      let token = tokens[i];
      let pos = token[3] || token[2];
      if (pos) return pos;
    }
  }
  class Parser {
    constructor(input2) {
      this.input = input2;
      this.root = new Root();
      this.current = this.root;
      this.spaces = "";
      this.semicolon = false;
      this.createTokenizer();
      this.root.source = { input: input2, start: { column: 1, line: 1, offset: 0 } };
    }
    atrule(token) {
      let node2 = new AtRule();
      node2.name = token[1].slice(1);
      if (node2.name === "") {
        this.unnamedAtrule(node2, token);
      }
      this.init(node2, token[2]);
      let type;
      let prev;
      let shift;
      let last = false;
      let open = false;
      let params = [];
      let brackets = [];
      while (!this.tokenizer.endOfFile()) {
        token = this.tokenizer.nextToken();
        type = token[0];
        if (type === "(" || type === "[") {
          brackets.push(type === "(" ? ")" : "]");
        } else if (type === "{" && brackets.length > 0) {
          brackets.push("}");
        } else if (type === brackets[brackets.length - 1]) {
          brackets.pop();
        }
        if (brackets.length === 0) {
          if (type === ";") {
            node2.source.end = this.getPosition(token[2]);
            node2.source.end.offset++;
            this.semicolon = true;
            break;
          } else if (type === "{") {
            open = true;
            break;
          } else if (type === "}") {
            if (params.length > 0) {
              shift = params.length - 1;
              prev = params[shift];
              while (prev && prev[0] === "space") {
                prev = params[--shift];
              }
              if (prev) {
                node2.source.end = this.getPosition(prev[3] || prev[2]);
                node2.source.end.offset++;
              }
            }
            this.end(token);
            break;
          } else {
            params.push(token);
          }
        } else {
          params.push(token);
        }
        if (this.tokenizer.endOfFile()) {
          last = true;
          break;
        }
      }
      node2.raws.between = this.spacesAndCommentsFromEnd(params);
      if (params.length) {
        node2.raws.afterName = this.spacesAndCommentsFromStart(params);
        this.raw(node2, "params", params);
        if (last) {
          token = params[params.length - 1];
          node2.source.end = this.getPosition(token[3] || token[2]);
          node2.source.end.offset++;
          this.spaces = node2.raws.between;
          node2.raws.between = "";
        }
      } else {
        node2.raws.afterName = "";
        node2.params = "";
      }
      if (open) {
        node2.nodes = [];
        this.current = node2;
      }
    }
    checkMissedSemicolon(tokens) {
      let colon = this.colon(tokens);
      if (colon === false) return;
      let founded = 0;
      let token;
      for (let j = colon - 1; j >= 0; j--) {
        token = tokens[j];
        if (token[0] !== "space") {
          founded += 1;
          if (founded === 2) break;
        }
      }
      throw this.input.error(
        "Missed semicolon",
        token[0] === "word" ? token[3] + 1 : token[2]
      );
    }
    colon(tokens) {
      let brackets = 0;
      let prev, token, type;
      for (let [i, element] of tokens.entries()) {
        token = element;
        type = token[0];
        if (type === "(") {
          brackets += 1;
        }
        if (type === ")") {
          brackets -= 1;
        }
        if (brackets === 0 && type === ":") {
          if (!prev) {
            this.doubleColon(token);
          } else if (prev[0] === "word" && prev[1] === "progid") {
            continue;
          } else {
            return i;
          }
        }
        prev = token;
      }
      return false;
    }
    comment(token) {
      let node2 = new Comment();
      this.init(node2, token[2]);
      node2.source.end = this.getPosition(token[3] || token[2]);
      node2.source.end.offset++;
      let text = token[1].slice(2, -2);
      if (/^\s*$/.test(text)) {
        node2.text = "";
        node2.raws.left = text;
        node2.raws.right = "";
      } else {
        let match = text.match(/^(\s*)([^]*\S)(\s*)$/);
        node2.text = match[2];
        node2.raws.left = match[1];
        node2.raws.right = match[3];
      }
    }
    createTokenizer() {
      this.tokenizer = tokenizer(this.input);
    }
    decl(tokens, customProperty) {
      let node2 = new Declaration();
      this.init(node2, tokens[0][2]);
      let last = tokens[tokens.length - 1];
      if (last[0] === ";") {
        this.semicolon = true;
        tokens.pop();
      }
      node2.source.end = this.getPosition(
        last[3] || last[2] || findLastWithPosition(tokens)
      );
      node2.source.end.offset++;
      while (tokens[0][0] !== "word") {
        if (tokens.length === 1) this.unknownWord(tokens);
        node2.raws.before += tokens.shift()[1];
      }
      node2.source.start = this.getPosition(tokens[0][2]);
      node2.prop = "";
      while (tokens.length) {
        let type = tokens[0][0];
        if (type === ":" || type === "space" || type === "comment") {
          break;
        }
        node2.prop += tokens.shift()[1];
      }
      node2.raws.between = "";
      let token;
      while (tokens.length) {
        token = tokens.shift();
        if (token[0] === ":") {
          node2.raws.between += token[1];
          break;
        } else {
          if (token[0] === "word" && /\w/.test(token[1])) {
            this.unknownWord([token]);
          }
          node2.raws.between += token[1];
        }
      }
      if (node2.prop[0] === "_" || node2.prop[0] === "*") {
        node2.raws.before += node2.prop[0];
        node2.prop = node2.prop.slice(1);
      }
      let firstSpaces = [];
      let next;
      while (tokens.length) {
        next = tokens[0][0];
        if (next !== "space" && next !== "comment") break;
        firstSpaces.push(tokens.shift());
      }
      this.precheckMissedSemicolon(tokens);
      for (let i = tokens.length - 1; i >= 0; i--) {
        token = tokens[i];
        if (token[1].toLowerCase() === "!important") {
          node2.important = true;
          let string2 = this.stringFrom(tokens, i);
          string2 = this.spacesFromEnd(tokens) + string2;
          if (string2 !== " !important") node2.raws.important = string2;
          break;
        } else if (token[1].toLowerCase() === "important") {
          let cache = tokens.slice(0);
          let str = "";
          for (let j = i; j > 0; j--) {
            let type = cache[j][0];
            if (str.trim().startsWith("!") && type !== "space") {
              break;
            }
            str = cache.pop()[1] + str;
          }
          if (str.trim().startsWith("!")) {
            node2.important = true;
            node2.raws.important = str;
            tokens = cache;
          }
        }
        if (token[0] !== "space" && token[0] !== "comment") {
          break;
        }
      }
      let hasWord = tokens.some((i) => i[0] !== "space" && i[0] !== "comment");
      if (hasWord) {
        node2.raws.between += firstSpaces.map((i) => i[1]).join("");
        firstSpaces = [];
      }
      this.raw(node2, "value", firstSpaces.concat(tokens), customProperty);
      if (node2.value.includes(":") && !customProperty) {
        this.checkMissedSemicolon(tokens);
      }
    }
    doubleColon(token) {
      throw this.input.error(
        "Double colon",
        { offset: token[2] },
        { offset: token[2] + token[1].length }
      );
    }
    emptyRule(token) {
      let node2 = new Rule();
      this.init(node2, token[2]);
      node2.selector = "";
      node2.raws.between = "";
      this.current = node2;
    }
    end(token) {
      if (this.current.nodes && this.current.nodes.length) {
        this.current.raws.semicolon = this.semicolon;
      }
      this.semicolon = false;
      this.current.raws.after = (this.current.raws.after || "") + this.spaces;
      this.spaces = "";
      if (this.current.parent) {
        this.current.source.end = this.getPosition(token[2]);
        this.current.source.end.offset++;
        this.current = this.current.parent;
      } else {
        this.unexpectedClose(token);
      }
    }
    endFile() {
      if (this.current.parent) this.unclosedBlock();
      if (this.current.nodes && this.current.nodes.length) {
        this.current.raws.semicolon = this.semicolon;
      }
      this.current.raws.after = (this.current.raws.after || "") + this.spaces;
      this.root.source.end = this.getPosition(this.tokenizer.position());
    }
    freeSemicolon(token) {
      this.spaces += token[1];
      if (this.current.nodes) {
        let prev = this.current.nodes[this.current.nodes.length - 1];
        if (prev && prev.type === "rule" && !prev.raws.ownSemicolon) {
          prev.raws.ownSemicolon = this.spaces;
          this.spaces = "";
          prev.source.end = this.getPosition(token[2]);
          prev.source.end.offset += prev.raws.ownSemicolon.length;
        }
      }
    }
    // Helpers
    getPosition(offset) {
      let pos = this.input.fromOffset(offset);
      return {
        column: pos.col,
        line: pos.line,
        offset
      };
    }
    init(node2, offset) {
      this.current.push(node2);
      node2.source = {
        input: this.input,
        start: this.getPosition(offset)
      };
      node2.raws.before = this.spaces;
      this.spaces = "";
      if (node2.type !== "comment") this.semicolon = false;
    }
    other(start) {
      let end = false;
      let type = null;
      let colon = false;
      let bracket = null;
      let brackets = [];
      let customProperty = start[1].startsWith("--");
      let tokens = [];
      let token = start;
      while (token) {
        type = token[0];
        tokens.push(token);
        if (type === "(" || type === "[") {
          if (!bracket) bracket = token;
          brackets.push(type === "(" ? ")" : "]");
        } else if (customProperty && colon && type === "{") {
          if (!bracket) bracket = token;
          brackets.push("}");
        } else if (brackets.length === 0) {
          if (type === ";") {
            if (colon) {
              this.decl(tokens, customProperty);
              return;
            } else {
              break;
            }
          } else if (type === "{") {
            this.rule(tokens);
            return;
          } else if (type === "}") {
            this.tokenizer.back(tokens.pop());
            end = true;
            break;
          } else if (type === ":") {
            colon = true;
          }
        } else if (type === brackets[brackets.length - 1]) {
          brackets.pop();
          if (brackets.length === 0) bracket = null;
        }
        token = this.tokenizer.nextToken();
      }
      if (this.tokenizer.endOfFile()) end = true;
      if (brackets.length > 0) this.unclosedBracket(bracket);
      if (end && colon) {
        if (!customProperty) {
          while (tokens.length) {
            token = tokens[tokens.length - 1][0];
            if (token !== "space" && token !== "comment") break;
            this.tokenizer.back(tokens.pop());
          }
        }
        this.decl(tokens, customProperty);
      } else {
        this.unknownWord(tokens);
      }
    }
    parse() {
      let token;
      while (!this.tokenizer.endOfFile()) {
        token = this.tokenizer.nextToken();
        switch (token[0]) {
          case "space":
            this.spaces += token[1];
            break;
          case ";":
            this.freeSemicolon(token);
            break;
          case "}":
            this.end(token);
            break;
          case "comment":
            this.comment(token);
            break;
          case "at-word":
            this.atrule(token);
            break;
          case "{":
            this.emptyRule(token);
            break;
          default:
            this.other(token);
            break;
        }
      }
      this.endFile();
    }
    precheckMissedSemicolon() {
    }
    raw(node2, prop, tokens, customProperty) {
      let token, type;
      let length = tokens.length;
      let value = "";
      let clean = true;
      let next, prev;
      for (let i = 0; i < length; i += 1) {
        token = tokens[i];
        type = token[0];
        if (type === "space" && i === length - 1 && !customProperty) {
          clean = false;
        } else if (type === "comment") {
          prev = tokens[i - 1] ? tokens[i - 1][0] : "empty";
          next = tokens[i + 1] ? tokens[i + 1][0] : "empty";
          if (!SAFE_COMMENT_NEIGHBOR[prev] && !SAFE_COMMENT_NEIGHBOR[next]) {
            if (value.slice(-1) === ",") {
              clean = false;
            } else {
              value += token[1];
            }
          } else {
            clean = false;
          }
        } else {
          value += token[1];
        }
      }
      if (!clean) {
        let raw = tokens.reduce((all, i) => all + i[1], "");
        node2.raws[prop] = { raw, value };
      }
      node2[prop] = value;
    }
    rule(tokens) {
      tokens.pop();
      let node2 = new Rule();
      this.init(node2, tokens[0][2]);
      node2.raws.between = this.spacesAndCommentsFromEnd(tokens);
      this.raw(node2, "selector", tokens);
      this.current = node2;
    }
    spacesAndCommentsFromEnd(tokens) {
      let lastTokenType;
      let spaces = "";
      while (tokens.length) {
        lastTokenType = tokens[tokens.length - 1][0];
        if (lastTokenType !== "space" && lastTokenType !== "comment") break;
        spaces = tokens.pop()[1] + spaces;
      }
      return spaces;
    }
    // Errors
    spacesAndCommentsFromStart(tokens) {
      let next;
      let spaces = "";
      while (tokens.length) {
        next = tokens[0][0];
        if (next !== "space" && next !== "comment") break;
        spaces += tokens.shift()[1];
      }
      return spaces;
    }
    spacesFromEnd(tokens) {
      let lastTokenType;
      let spaces = "";
      while (tokens.length) {
        lastTokenType = tokens[tokens.length - 1][0];
        if (lastTokenType !== "space") break;
        spaces = tokens.pop()[1] + spaces;
      }
      return spaces;
    }
    stringFrom(tokens, from) {
      let result2 = "";
      for (let i = from; i < tokens.length; i++) {
        result2 += tokens[i][1];
      }
      tokens.splice(from, tokens.length - from);
      return result2;
    }
    unclosedBlock() {
      let pos = this.current.source.start;
      throw this.input.error("Unclosed block", pos.line, pos.column);
    }
    unclosedBracket(bracket) {
      throw this.input.error(
        "Unclosed bracket",
        { offset: bracket[2] },
        { offset: bracket[2] + 1 }
      );
    }
    unexpectedClose(token) {
      throw this.input.error(
        "Unexpected }",
        { offset: token[2] },
        { offset: token[2] + 1 }
      );
    }
    unknownWord(tokens) {
      throw this.input.error(
        "Unknown word " + tokens[0][1],
        { offset: tokens[0][2] },
        { offset: tokens[0][2] + tokens[0][1].length }
      );
    }
    unnamedAtrule(node2, token) {
      throw this.input.error(
        "At-rule without name",
        { offset: token[2] },
        { offset: token[2] + token[1].length }
      );
    }
  }
  parser$2 = Parser;
  return parser$2;
}
var parse_1;
var hasRequiredParse$1;
function requireParse$1() {
  if (hasRequiredParse$1) return parse_1;
  hasRequiredParse$1 = 1;
  let Container = requireContainer$1();
  let Input = requireInput();
  let Parser = requireParser$2();
  function parse2(css, opts) {
    let input2 = new Input(css, opts);
    let parser2 = new Parser(input2);
    try {
      parser2.parse();
    } catch (e2) {
      throw e2;
    }
    return parser2.root;
  }
  parse_1 = parse2;
  parse2.default = parse2;
  Container.registerParse(parse2);
  return parse_1;
}
var warning;
var hasRequiredWarning;
function requireWarning() {
  if (hasRequiredWarning) return warning;
  hasRequiredWarning = 1;
  class Warning {
    constructor(text, opts = {}) {
      this.type = "warning";
      this.text = text;
      if (opts.node && opts.node.source) {
        let range = opts.node.rangeBy(opts);
        this.line = range.start.line;
        this.column = range.start.column;
        this.endLine = range.end.line;
        this.endColumn = range.end.column;
      }
      for (let opt in opts) this[opt] = opts[opt];
    }
    toString() {
      if (this.node) {
        return this.node.error(this.text, {
          index: this.index,
          plugin: this.plugin,
          word: this.word
        }).message;
      }
      if (this.plugin) {
        return this.plugin + ": " + this.text;
      }
      return this.text;
    }
  }
  warning = Warning;
  Warning.default = Warning;
  return warning;
}
var result;
var hasRequiredResult;
function requireResult() {
  if (hasRequiredResult) return result;
  hasRequiredResult = 1;
  let Warning = requireWarning();
  class Result {
    get content() {
      return this.css;
    }
    constructor(processor2, root2, opts) {
      this.processor = processor2;
      this.messages = [];
      this.root = root2;
      this.opts = opts;
      this.css = void 0;
      this.map = void 0;
    }
    toString() {
      return this.css;
    }
    warn(text, opts = {}) {
      if (!opts.plugin) {
        if (this.lastPlugin && this.lastPlugin.postcssPlugin) {
          opts.plugin = this.lastPlugin.postcssPlugin;
        }
      }
      let warning2 = new Warning(text, opts);
      this.messages.push(warning2);
      return warning2;
    }
    warnings() {
      return this.messages.filter((i) => i.type === "warning");
    }
  }
  result = Result;
  Result.default = Result;
  return result;
}
var lazyResult;
var hasRequiredLazyResult;
function requireLazyResult() {
  if (hasRequiredLazyResult) return lazyResult;
  hasRequiredLazyResult = 1;
  let Container = requireContainer$1();
  let Document = requireDocument();
  let MapGenerator = requireMapGenerator();
  let parse2 = requireParse$1();
  let Result = requireResult();
  let Root = requireRoot$1();
  let stringify = requireStringify$1();
  let { isClean, my } = requireSymbols();
  const TYPE_TO_CLASS_NAME = {
    atrule: "AtRule",
    comment: "Comment",
    decl: "Declaration",
    document: "Document",
    root: "Root",
    rule: "Rule"
  };
  const PLUGIN_PROPS = {
    AtRule: true,
    AtRuleExit: true,
    Comment: true,
    CommentExit: true,
    Declaration: true,
    DeclarationExit: true,
    Document: true,
    DocumentExit: true,
    Once: true,
    OnceExit: true,
    postcssPlugin: true,
    prepare: true,
    Root: true,
    RootExit: true,
    Rule: true,
    RuleExit: true
  };
  const NOT_VISITORS = {
    Once: true,
    postcssPlugin: true,
    prepare: true
  };
  const CHILDREN = 0;
  function isPromise(obj) {
    return typeof obj === "object" && typeof obj.then === "function";
  }
  function getEvents(node2) {
    let key = false;
    let type = TYPE_TO_CLASS_NAME[node2.type];
    if (node2.type === "decl") {
      key = node2.prop.toLowerCase();
    } else if (node2.type === "atrule") {
      key = node2.name.toLowerCase();
    }
    if (key && node2.append) {
      return [
        type,
        type + "-" + key,
        CHILDREN,
        type + "Exit",
        type + "Exit-" + key
      ];
    } else if (key) {
      return [type, type + "-" + key, type + "Exit", type + "Exit-" + key];
    } else if (node2.append) {
      return [type, CHILDREN, type + "Exit"];
    } else {
      return [type, type + "Exit"];
    }
  }
  function toStack(node2) {
    let events;
    if (node2.type === "document") {
      events = ["Document", CHILDREN, "DocumentExit"];
    } else if (node2.type === "root") {
      events = ["Root", CHILDREN, "RootExit"];
    } else {
      events = getEvents(node2);
    }
    return {
      eventIndex: 0,
      events,
      iterator: 0,
      node: node2,
      visitorIndex: 0,
      visitors: []
    };
  }
  function cleanMarks(node2) {
    node2[isClean] = false;
    if (node2.nodes) node2.nodes.forEach((i) => cleanMarks(i));
    return node2;
  }
  let postcss2 = {};
  class LazyResult {
    get content() {
      return this.stringify().content;
    }
    get css() {
      return this.stringify().css;
    }
    get map() {
      return this.stringify().map;
    }
    get messages() {
      return this.sync().messages;
    }
    get opts() {
      return this.result.opts;
    }
    get processor() {
      return this.result.processor;
    }
    get root() {
      return this.sync().root;
    }
    get [Symbol.toStringTag]() {
      return "LazyResult";
    }
    constructor(processor2, css, opts) {
      this.stringified = false;
      this.processed = false;
      let root2;
      if (typeof css === "object" && css !== null && (css.type === "root" || css.type === "document")) {
        root2 = cleanMarks(css);
      } else if (css instanceof LazyResult || css instanceof Result) {
        root2 = cleanMarks(css.root);
        if (css.map) {
          if (typeof opts.map === "undefined") opts.map = {};
          if (!opts.map.inline) opts.map.inline = false;
          opts.map.prev = css.map;
        }
      } else {
        let parser2 = parse2;
        if (opts.syntax) parser2 = opts.syntax.parse;
        if (opts.parser) parser2 = opts.parser;
        if (parser2.parse) parser2 = parser2.parse;
        try {
          root2 = parser2(css, opts);
        } catch (error) {
          this.processed = true;
          this.error = error;
        }
        if (root2 && !root2[my]) {
          Container.rebuild(root2);
        }
      }
      this.result = new Result(processor2, root2, opts);
      this.helpers = { ...postcss2, postcss: postcss2, result: this.result };
      this.plugins = this.processor.plugins.map((plugin) => {
        if (typeof plugin === "object" && plugin.prepare) {
          return { ...plugin, ...plugin.prepare(this.result) };
        } else {
          return plugin;
        }
      });
    }
    async() {
      if (this.error) return Promise.reject(this.error);
      if (this.processed) return Promise.resolve(this.result);
      if (!this.processing) {
        this.processing = this.runAsync();
      }
      return this.processing;
    }
    catch(onRejected) {
      return this.async().catch(onRejected);
    }
    finally(onFinally) {
      return this.async().then(onFinally, onFinally);
    }
    getAsyncError() {
      throw new Error("Use process(css).then(cb) to work with async plugins");
    }
    handleError(error, node2) {
      let plugin = this.result.lastPlugin;
      try {
        if (node2) node2.addToError(error);
        this.error = error;
        if (error.name === "CssSyntaxError" && !error.plugin) {
          error.plugin = plugin.postcssPlugin;
          error.setMessage();
        } else if (plugin.postcssVersion) {
          if (false) ;
        }
      } catch (err) {
        if (console && console.error) console.error(err);
      }
      return error;
    }
    prepareVisitors() {
      this.listeners = {};
      let add = (plugin, type, cb) => {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push([plugin, cb]);
      };
      for (let plugin of this.plugins) {
        if (typeof plugin === "object") {
          for (let event in plugin) {
            if (!PLUGIN_PROPS[event] && /^[A-Z]/.test(event)) {
              throw new Error(
                `Unknown event ${event} in ${plugin.postcssPlugin}. Try to update PostCSS (${this.processor.version} now).`
              );
            }
            if (!NOT_VISITORS[event]) {
              if (typeof plugin[event] === "object") {
                for (let filter in plugin[event]) {
                  if (filter === "*") {
                    add(plugin, event, plugin[event][filter]);
                  } else {
                    add(
                      plugin,
                      event + "-" + filter.toLowerCase(),
                      plugin[event][filter]
                    );
                  }
                }
              } else if (typeof plugin[event] === "function") {
                add(plugin, event, plugin[event]);
              }
            }
          }
        }
      }
      this.hasListener = Object.keys(this.listeners).length > 0;
    }
    async runAsync() {
      this.plugin = 0;
      for (let i = 0; i < this.plugins.length; i++) {
        let plugin = this.plugins[i];
        let promise = this.runOnRoot(plugin);
        if (isPromise(promise)) {
          try {
            await promise;
          } catch (error) {
            throw this.handleError(error);
          }
        }
      }
      this.prepareVisitors();
      if (this.hasListener) {
        let root2 = this.result.root;
        while (!root2[isClean]) {
          root2[isClean] = true;
          let stack = [toStack(root2)];
          while (stack.length > 0) {
            let promise = this.visitTick(stack);
            if (isPromise(promise)) {
              try {
                await promise;
              } catch (e2) {
                let node2 = stack[stack.length - 1].node;
                throw this.handleError(e2, node2);
              }
            }
          }
        }
        if (this.listeners.OnceExit) {
          for (let [plugin, visitor] of this.listeners.OnceExit) {
            this.result.lastPlugin = plugin;
            try {
              if (root2.type === "document") {
                let roots = root2.nodes.map(
                  (subRoot) => visitor(subRoot, this.helpers)
                );
                await Promise.all(roots);
              } else {
                await visitor(root2, this.helpers);
              }
            } catch (e2) {
              throw this.handleError(e2);
            }
          }
        }
      }
      this.processed = true;
      return this.stringify();
    }
    runOnRoot(plugin) {
      this.result.lastPlugin = plugin;
      try {
        if (typeof plugin === "object" && plugin.Once) {
          if (this.result.root.type === "document") {
            let roots = this.result.root.nodes.map(
              (root2) => plugin.Once(root2, this.helpers)
            );
            if (isPromise(roots[0])) {
              return Promise.all(roots);
            }
            return roots;
          }
          return plugin.Once(this.result.root, this.helpers);
        } else if (typeof plugin === "function") {
          return plugin(this.result.root, this.result);
        }
      } catch (error) {
        throw this.handleError(error);
      }
    }
    stringify() {
      if (this.error) throw this.error;
      if (this.stringified) return this.result;
      this.stringified = true;
      this.sync();
      let opts = this.result.opts;
      let str = stringify;
      if (opts.syntax) str = opts.syntax.stringify;
      if (opts.stringifier) str = opts.stringifier;
      if (str.stringify) str = str.stringify;
      let map = new MapGenerator(str, this.result.root, this.result.opts);
      let data = map.generate();
      this.result.css = data[0];
      this.result.map = data[1];
      return this.result;
    }
    sync() {
      if (this.error) throw this.error;
      if (this.processed) return this.result;
      this.processed = true;
      if (this.processing) {
        throw this.getAsyncError();
      }
      for (let plugin of this.plugins) {
        let promise = this.runOnRoot(plugin);
        if (isPromise(promise)) {
          throw this.getAsyncError();
        }
      }
      this.prepareVisitors();
      if (this.hasListener) {
        let root2 = this.result.root;
        while (!root2[isClean]) {
          root2[isClean] = true;
          this.walkSync(root2);
        }
        if (this.listeners.OnceExit) {
          if (root2.type === "document") {
            for (let subRoot of root2.nodes) {
              this.visitSync(this.listeners.OnceExit, subRoot);
            }
          } else {
            this.visitSync(this.listeners.OnceExit, root2);
          }
        }
      }
      return this.result;
    }
    then(onFulfilled, onRejected) {
      return this.async().then(onFulfilled, onRejected);
    }
    toString() {
      return this.css;
    }
    visitSync(visitors, node2) {
      for (let [plugin, visitor] of visitors) {
        this.result.lastPlugin = plugin;
        let promise;
        try {
          promise = visitor(node2, this.helpers);
        } catch (e2) {
          throw this.handleError(e2, node2.proxyOf);
        }
        if (node2.type !== "root" && node2.type !== "document" && !node2.parent) {
          return true;
        }
        if (isPromise(promise)) {
          throw this.getAsyncError();
        }
      }
    }
    visitTick(stack) {
      let visit = stack[stack.length - 1];
      let { node: node2, visitors } = visit;
      if (node2.type !== "root" && node2.type !== "document" && !node2.parent) {
        stack.pop();
        return;
      }
      if (visitors.length > 0 && visit.visitorIndex < visitors.length) {
        let [plugin, visitor] = visitors[visit.visitorIndex];
        visit.visitorIndex += 1;
        if (visit.visitorIndex === visitors.length) {
          visit.visitors = [];
          visit.visitorIndex = 0;
        }
        this.result.lastPlugin = plugin;
        try {
          return visitor(node2.toProxy(), this.helpers);
        } catch (e2) {
          throw this.handleError(e2, node2);
        }
      }
      if (visit.iterator !== 0) {
        let iterator = visit.iterator;
        let child;
        while (child = node2.nodes[node2.indexes[iterator]]) {
          node2.indexes[iterator] += 1;
          if (!child[isClean]) {
            child[isClean] = true;
            stack.push(toStack(child));
            return;
          }
        }
        visit.iterator = 0;
        delete node2.indexes[iterator];
      }
      let events = visit.events;
      while (visit.eventIndex < events.length) {
        let event = events[visit.eventIndex];
        visit.eventIndex += 1;
        if (event === CHILDREN) {
          if (node2.nodes && node2.nodes.length) {
            node2[isClean] = true;
            visit.iterator = node2.getIterator();
          }
          return;
        } else if (this.listeners[event]) {
          visit.visitors = this.listeners[event];
          return;
        }
      }
      stack.pop();
    }
    walkSync(node2) {
      node2[isClean] = true;
      let events = getEvents(node2);
      for (let event of events) {
        if (event === CHILDREN) {
          if (node2.nodes) {
            node2.each((child) => {
              if (!child[isClean]) this.walkSync(child);
            });
          }
        } else {
          let visitors = this.listeners[event];
          if (visitors) {
            if (this.visitSync(visitors, node2.toProxy())) return;
          }
        }
      }
    }
    warnings() {
      return this.sync().warnings();
    }
  }
  LazyResult.registerPostcss = (dependant) => {
    postcss2 = dependant;
  };
  lazyResult = LazyResult;
  LazyResult.default = LazyResult;
  Root.registerLazyResult(LazyResult);
  Document.registerLazyResult(LazyResult);
  return lazyResult;
}
var noWorkResult;
var hasRequiredNoWorkResult;
function requireNoWorkResult() {
  if (hasRequiredNoWorkResult) return noWorkResult;
  hasRequiredNoWorkResult = 1;
  let MapGenerator = requireMapGenerator();
  let parse2 = requireParse$1();
  const Result = requireResult();
  let stringify = requireStringify$1();
  class NoWorkResult {
    get content() {
      return this.result.css;
    }
    get css() {
      return this.result.css;
    }
    get map() {
      return this.result.map;
    }
    get messages() {
      return [];
    }
    get opts() {
      return this.result.opts;
    }
    get processor() {
      return this.result.processor;
    }
    get root() {
      if (this._root) {
        return this._root;
      }
      let root2;
      let parser2 = parse2;
      try {
        root2 = parser2(this._css, this._opts);
      } catch (error) {
        this.error = error;
      }
      if (this.error) {
        throw this.error;
      } else {
        this._root = root2;
        return root2;
      }
    }
    get [Symbol.toStringTag]() {
      return "NoWorkResult";
    }
    constructor(processor2, css, opts) {
      css = css.toString();
      this.stringified = false;
      this._processor = processor2;
      this._css = css;
      this._opts = opts;
      this._map = void 0;
      let root2;
      let str = stringify;
      this.result = new Result(this._processor, root2, this._opts);
      this.result.css = css;
      let self2 = this;
      Object.defineProperty(this.result, "root", {
        get() {
          return self2.root;
        }
      });
      let map = new MapGenerator(str, root2, this._opts, css);
      if (map.isMap()) {
        let [generatedCSS, generatedMap] = map.generate();
        if (generatedCSS) {
          this.result.css = generatedCSS;
        }
        if (generatedMap) {
          this.result.map = generatedMap;
        }
      } else {
        map.clearAnnotation();
        this.result.css = map.css;
      }
    }
    async() {
      if (this.error) return Promise.reject(this.error);
      return Promise.resolve(this.result);
    }
    catch(onRejected) {
      return this.async().catch(onRejected);
    }
    finally(onFinally) {
      return this.async().then(onFinally, onFinally);
    }
    sync() {
      if (this.error) throw this.error;
      return this.result;
    }
    then(onFulfilled, onRejected) {
      return this.async().then(onFulfilled, onRejected);
    }
    toString() {
      return this._css;
    }
    warnings() {
      return [];
    }
  }
  noWorkResult = NoWorkResult;
  NoWorkResult.default = NoWorkResult;
  return noWorkResult;
}
var processor$1;
var hasRequiredProcessor$1;
function requireProcessor$1() {
  if (hasRequiredProcessor$1) return processor$1;
  hasRequiredProcessor$1 = 1;
  let Document = requireDocument();
  let LazyResult = requireLazyResult();
  let NoWorkResult = requireNoWorkResult();
  let Root = requireRoot$1();
  class Processor {
    constructor(plugins = []) {
      this.version = "8.5.3";
      this.plugins = this.normalize(plugins);
    }
    normalize(plugins) {
      let normalized = [];
      for (let i of plugins) {
        if (i.postcss === true) {
          i = i();
        } else if (i.postcss) {
          i = i.postcss;
        }
        if (typeof i === "object" && Array.isArray(i.plugins)) {
          normalized = normalized.concat(i.plugins);
        } else if (typeof i === "object" && i.postcssPlugin) {
          normalized.push(i);
        } else if (typeof i === "function") {
          normalized.push(i);
        } else if (typeof i === "object" && (i.parse || i.stringify)) ;
        else {
          throw new Error(i + " is not a PostCSS plugin");
        }
      }
      return normalized;
    }
    process(css, opts = {}) {
      if (!this.plugins.length && !opts.parser && !opts.stringifier && !opts.syntax) {
        return new NoWorkResult(this, css, opts);
      } else {
        return new LazyResult(this, css, opts);
      }
    }
    use(plugin) {
      this.plugins = this.plugins.concat(this.normalize([plugin]));
      return this;
    }
  }
  processor$1 = Processor;
  Processor.default = Processor;
  Root.registerProcessor(Processor);
  Document.registerProcessor(Processor);
  return processor$1;
}
var postcss_1;
var hasRequiredPostcss;
function requirePostcss() {
  if (hasRequiredPostcss) return postcss_1;
  hasRequiredPostcss = 1;
  var define_process_env_default = {};
  let AtRule = requireAtRule();
  let Comment = requireComment$1();
  let Container = requireContainer$1();
  let CssSyntaxError = requireCssSyntaxError();
  let Declaration = requireDeclaration();
  let Document = requireDocument();
  let fromJSON = requireFromJSON();
  let Input = requireInput();
  let LazyResult = requireLazyResult();
  let list = requireList();
  let Node = requireNode$1();
  let parse2 = requireParse$1();
  let Processor = requireProcessor$1();
  let Result = requireResult();
  let Root = requireRoot$1();
  let Rule = requireRule();
  let stringify = requireStringify$1();
  let Warning = requireWarning();
  function postcss2(...plugins) {
    if (plugins.length === 1 && Array.isArray(plugins[0])) {
      plugins = plugins[0];
    }
    return new Processor(plugins);
  }
  postcss2.plugin = function plugin(name, initializer) {
    let warningPrinted = false;
    function creator(...args) {
      if (console && console.warn && !warningPrinted) {
        warningPrinted = true;
        console.warn(
          name + ": postcss.plugin was deprecated. Migration guide:\nhttps://evilmartians.com/chronicles/postcss-8-plugin-migration"
        );
        if (define_process_env_default.LANG && define_process_env_default.LANG.startsWith("cn")) {
          console.warn(
            name + ": 里面 postcss.plugin 被弃用. 迁移指南:\nhttps://www.w3ctech.com/topic/2226"
          );
        }
      }
      let transformer = initializer(...args);
      transformer.postcssPlugin = name;
      transformer.postcssVersion = new Processor().version;
      return transformer;
    }
    let cache;
    Object.defineProperty(creator, "postcss", {
      get() {
        if (!cache) cache = creator();
        return cache;
      }
    });
    creator.process = function(css, processOpts, pluginOpts) {
      return postcss2([creator(pluginOpts)]).process(css, processOpts);
    };
    return creator;
  };
  postcss2.stringify = stringify;
  postcss2.parse = parse2;
  postcss2.fromJSON = fromJSON;
  postcss2.list = list;
  postcss2.comment = (defaults) => new Comment(defaults);
  postcss2.atRule = (defaults) => new AtRule(defaults);
  postcss2.decl = (defaults) => new Declaration(defaults);
  postcss2.rule = (defaults) => new Rule(defaults);
  postcss2.root = (defaults) => new Root(defaults);
  postcss2.document = (defaults) => new Document(defaults);
  postcss2.CssSyntaxError = CssSyntaxError;
  postcss2.Declaration = Declaration;
  postcss2.Container = Container;
  postcss2.Processor = Processor;
  postcss2.Document = Document;
  postcss2.Comment = Comment;
  postcss2.Warning = Warning;
  postcss2.AtRule = AtRule;
  postcss2.Result = Result;
  postcss2.Input = Input;
  postcss2.Rule = Rule;
  postcss2.Root = Root;
  postcss2.Node = Node;
  LazyResult.registerPostcss(postcss2);
  postcss_1 = postcss2;
  postcss2.default = postcss2;
  return postcss_1;
}
var postcssExports = requirePostcss();
const postcss = /* @__PURE__ */ getDefaultExportFromCjs(postcssExports);
postcss.stringify;
postcss.fromJSON;
postcss.plugin;
postcss.parse;
postcss.list;
postcss.document;
postcss.comment;
postcss.atRule;
postcss.rule;
postcss.decl;
postcss.root;
postcss.CssSyntaxError;
postcss.Declaration;
postcss.Container;
postcss.Processor;
postcss.Document;
postcss.Comment;
postcss.Warning;
postcss.AtRule;
postcss.Result;
postcss.Input;
postcss.Rule;
postcss.Root;
postcss.Node;
var dist = { exports: {} };
var processor = { exports: {} };
var parser$1 = { exports: {} };
var root = { exports: {} };
var container = { exports: {} };
var node = { exports: {} };
var util = {};
var unesc = { exports: {} };
var hasRequiredUnesc;
function requireUnesc() {
  if (hasRequiredUnesc) return unesc.exports;
  hasRequiredUnesc = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = unesc2;
    function gobbleHex(str) {
      var lower = str.toLowerCase();
      var hex = "";
      var spaceTerminated = false;
      for (var i = 0; i < 6 && lower[i] !== void 0; i++) {
        var code = lower.charCodeAt(i);
        var valid = code >= 97 && code <= 102 || code >= 48 && code <= 57;
        spaceTerminated = code === 32;
        if (!valid) {
          break;
        }
        hex += lower[i];
      }
      if (hex.length === 0) {
        return void 0;
      }
      var codePoint = parseInt(hex, 16);
      var isSurrogate = codePoint >= 55296 && codePoint <= 57343;
      if (isSurrogate || codePoint === 0 || codePoint > 1114111) {
        return ["�", hex.length + (spaceTerminated ? 1 : 0)];
      }
      return [String.fromCodePoint(codePoint), hex.length + (spaceTerminated ? 1 : 0)];
    }
    var CONTAINS_ESCAPE = /\\/;
    function unesc2(str) {
      var needToProcess = CONTAINS_ESCAPE.test(str);
      if (!needToProcess) {
        return str;
      }
      var ret = "";
      for (var i = 0; i < str.length; i++) {
        if (str[i] === "\\") {
          var gobbled = gobbleHex(str.slice(i + 1, i + 7));
          if (gobbled !== void 0) {
            ret += gobbled[0];
            i += gobbled[1];
            continue;
          }
          if (str[i + 1] === "\\") {
            ret += "\\";
            i++;
            continue;
          }
          if (str.length === i + 1) {
            ret += str[i];
          }
          continue;
        }
        ret += str[i];
      }
      return ret;
    }
    module.exports = exports.default;
  })(unesc, unesc.exports);
  return unesc.exports;
}
var getProp = { exports: {} };
var hasRequiredGetProp;
function requireGetProp() {
  if (hasRequiredGetProp) return getProp.exports;
  hasRequiredGetProp = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = getProp2;
    function getProp2(obj) {
      for (var _len = arguments.length, props = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        props[_key - 1] = arguments[_key];
      }
      while (props.length > 0) {
        var prop = props.shift();
        if (!obj[prop]) {
          return void 0;
        }
        obj = obj[prop];
      }
      return obj;
    }
    module.exports = exports.default;
  })(getProp, getProp.exports);
  return getProp.exports;
}
var ensureObject = { exports: {} };
var hasRequiredEnsureObject;
function requireEnsureObject() {
  if (hasRequiredEnsureObject) return ensureObject.exports;
  hasRequiredEnsureObject = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = ensureObject2;
    function ensureObject2(obj) {
      for (var _len = arguments.length, props = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        props[_key - 1] = arguments[_key];
      }
      while (props.length > 0) {
        var prop = props.shift();
        if (!obj[prop]) {
          obj[prop] = {};
        }
        obj = obj[prop];
      }
    }
    module.exports = exports.default;
  })(ensureObject, ensureObject.exports);
  return ensureObject.exports;
}
var stripComments = { exports: {} };
var hasRequiredStripComments;
function requireStripComments() {
  if (hasRequiredStripComments) return stripComments.exports;
  hasRequiredStripComments = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = stripComments2;
    function stripComments2(str) {
      var s = "";
      var commentStart = str.indexOf("/*");
      var lastEnd = 0;
      while (commentStart >= 0) {
        s = s + str.slice(lastEnd, commentStart);
        var commentEnd = str.indexOf("*/", commentStart + 2);
        if (commentEnd < 0) {
          return s;
        }
        lastEnd = commentEnd + 2;
        commentStart = str.indexOf("/*", lastEnd);
      }
      s = s + str.slice(lastEnd);
      return s;
    }
    module.exports = exports.default;
  })(stripComments, stripComments.exports);
  return stripComments.exports;
}
var hasRequiredUtil;
function requireUtil() {
  if (hasRequiredUtil) return util;
  hasRequiredUtil = 1;
  util.__esModule = true;
  util.unesc = util.stripComments = util.getProp = util.ensureObject = void 0;
  var _unesc = _interopRequireDefault(requireUnesc());
  util.unesc = _unesc["default"];
  var _getProp = _interopRequireDefault(requireGetProp());
  util.getProp = _getProp["default"];
  var _ensureObject = _interopRequireDefault(requireEnsureObject());
  util.ensureObject = _ensureObject["default"];
  var _stripComments = _interopRequireDefault(requireStripComments());
  util.stripComments = _stripComments["default"];
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { "default": obj };
  }
  return util;
}
var hasRequiredNode;
function requireNode() {
  if (hasRequiredNode) return node.exports;
  hasRequiredNode = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _util = requireUtil();
    function _defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }
    function _createClass(Constructor, protoProps, staticProps) {
      if (protoProps) _defineProperties(Constructor.prototype, protoProps);
      Object.defineProperty(Constructor, "prototype", { writable: false });
      return Constructor;
    }
    var cloneNode = function cloneNode2(obj, parent2) {
      if (typeof obj !== "object" || obj === null) {
        return obj;
      }
      var cloned = new obj.constructor();
      for (var i in obj) {
        if (!obj.hasOwnProperty(i)) {
          continue;
        }
        var value = obj[i];
        var type = typeof value;
        if (i === "parent" && type === "object") {
          if (parent2) {
            cloned[i] = parent2;
          }
        } else if (value instanceof Array) {
          cloned[i] = value.map(function(j) {
            return cloneNode2(j, cloned);
          });
        } else {
          cloned[i] = cloneNode2(value, cloned);
        }
      }
      return cloned;
    };
    var Node = /* @__PURE__ */ function() {
      function Node2(opts) {
        if (opts === void 0) {
          opts = {};
        }
        Object.assign(this, opts);
        this.spaces = this.spaces || {};
        this.spaces.before = this.spaces.before || "";
        this.spaces.after = this.spaces.after || "";
      }
      var _proto = Node2.prototype;
      _proto.remove = function remove() {
        if (this.parent) {
          this.parent.removeChild(this);
        }
        this.parent = void 0;
        return this;
      };
      _proto.replaceWith = function replaceWith() {
        if (this.parent) {
          for (var index in arguments) {
            this.parent.insertBefore(this, arguments[index]);
          }
          this.remove();
        }
        return this;
      };
      _proto.next = function next() {
        return this.parent.at(this.parent.index(this) + 1);
      };
      _proto.prev = function prev() {
        return this.parent.at(this.parent.index(this) - 1);
      };
      _proto.clone = function clone(overrides) {
        if (overrides === void 0) {
          overrides = {};
        }
        var cloned = cloneNode(this);
        for (var name in overrides) {
          cloned[name] = overrides[name];
        }
        return cloned;
      };
      _proto.appendToPropertyAndEscape = function appendToPropertyAndEscape(name, value, valueEscaped) {
        if (!this.raws) {
          this.raws = {};
        }
        var originalValue = this[name];
        var originalEscaped = this.raws[name];
        this[name] = originalValue + value;
        if (originalEscaped || valueEscaped !== value) {
          this.raws[name] = (originalEscaped || originalValue) + valueEscaped;
        } else {
          delete this.raws[name];
        }
      };
      _proto.setPropertyAndEscape = function setPropertyAndEscape(name, value, valueEscaped) {
        if (!this.raws) {
          this.raws = {};
        }
        this[name] = value;
        this.raws[name] = valueEscaped;
      };
      _proto.setPropertyWithoutEscape = function setPropertyWithoutEscape(name, value) {
        this[name] = value;
        if (this.raws) {
          delete this.raws[name];
        }
      };
      _proto.isAtPosition = function isAtPosition(line, column) {
        if (this.source && this.source.start && this.source.end) {
          if (this.source.start.line > line) {
            return false;
          }
          if (this.source.end.line < line) {
            return false;
          }
          if (this.source.start.line === line && this.source.start.column > column) {
            return false;
          }
          if (this.source.end.line === line && this.source.end.column < column) {
            return false;
          }
          return true;
        }
        return void 0;
      };
      _proto.stringifyProperty = function stringifyProperty(name) {
        return this.raws && this.raws[name] || this[name];
      };
      _proto.valueToString = function valueToString() {
        return String(this.stringifyProperty("value"));
      };
      _proto.toString = function toString() {
        return [this.rawSpaceBefore, this.valueToString(), this.rawSpaceAfter].join("");
      };
      _createClass(Node2, [{
        key: "rawSpaceBefore",
        get: function get() {
          var rawSpace = this.raws && this.raws.spaces && this.raws.spaces.before;
          if (rawSpace === void 0) {
            rawSpace = this.spaces && this.spaces.before;
          }
          return rawSpace || "";
        },
        set: function set(raw) {
          (0, _util.ensureObject)(this, "raws", "spaces");
          this.raws.spaces.before = raw;
        }
      }, {
        key: "rawSpaceAfter",
        get: function get() {
          var rawSpace = this.raws && this.raws.spaces && this.raws.spaces.after;
          if (rawSpace === void 0) {
            rawSpace = this.spaces.after;
          }
          return rawSpace || "";
        },
        set: function set(raw) {
          (0, _util.ensureObject)(this, "raws", "spaces");
          this.raws.spaces.after = raw;
        }
      }]);
      return Node2;
    }();
    exports["default"] = Node;
    module.exports = exports.default;
  })(node, node.exports);
  return node.exports;
}
var types = {};
var hasRequiredTypes;
function requireTypes() {
  if (hasRequiredTypes) return types;
  hasRequiredTypes = 1;
  types.__esModule = true;
  types.UNIVERSAL = types.TAG = types.STRING = types.SELECTOR = types.ROOT = types.PSEUDO = types.NESTING = types.ID = types.COMMENT = types.COMBINATOR = types.CLASS = types.ATTRIBUTE = void 0;
  var TAG = "tag";
  types.TAG = TAG;
  var STRING = "string";
  types.STRING = STRING;
  var SELECTOR = "selector";
  types.SELECTOR = SELECTOR;
  var ROOT = "root";
  types.ROOT = ROOT;
  var PSEUDO = "pseudo";
  types.PSEUDO = PSEUDO;
  var NESTING = "nesting";
  types.NESTING = NESTING;
  var ID = "id";
  types.ID = ID;
  var COMMENT = "comment";
  types.COMMENT = COMMENT;
  var COMBINATOR = "combinator";
  types.COMBINATOR = COMBINATOR;
  var CLASS = "class";
  types.CLASS = CLASS;
  var ATTRIBUTE = "attribute";
  types.ATTRIBUTE = ATTRIBUTE;
  var UNIVERSAL = "universal";
  types.UNIVERSAL = UNIVERSAL;
  return types;
}
var hasRequiredContainer;
function requireContainer() {
  if (hasRequiredContainer) return container.exports;
  hasRequiredContainer = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _node = _interopRequireDefault(requireNode());
    var types2 = _interopRequireWildcard(requireTypes());
    function _getRequireWildcardCache(nodeInterop) {
      if (typeof WeakMap !== "function") return null;
      var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
      var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
      return (_getRequireWildcardCache = function _getRequireWildcardCache2(nodeInterop2) {
        return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
      })(nodeInterop);
    }
    function _interopRequireWildcard(obj, nodeInterop) {
      if (obj && obj.__esModule) {
        return obj;
      }
      if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return { "default": obj };
      }
      var cache = _getRequireWildcardCache(nodeInterop);
      if (cache && cache.has(obj)) {
        return cache.get(obj);
      }
      var newObj = {};
      var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
      for (var key in obj) {
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
          var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
          if (desc && (desc.get || desc.set)) {
            Object.defineProperty(newObj, key, desc);
          } else {
            newObj[key] = obj[key];
          }
        }
      }
      newObj["default"] = obj;
      if (cache) {
        cache.set(obj, newObj);
      }
      return newObj;
    }
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    function _createForOfIteratorHelperLoose(o, allowArrayLike) {
      var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
      if (it) return (it = it.call(o)).next.bind(it);
      if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike) {
        if (it) o = it;
        var i = 0;
        return function() {
          if (i >= o.length) return { done: true };
          return { done: false, value: o[i++] };
        };
      }
      throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
    }
    function _unsupportedIterableToArray(o, minLen) {
      if (!o) return;
      if (typeof o === "string") return _arrayLikeToArray(o, minLen);
      var n = Object.prototype.toString.call(o).slice(8, -1);
      if (n === "Object" && o.constructor) n = o.constructor.name;
      if (n === "Map" || n === "Set") return Array.from(o);
      if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
    }
    function _arrayLikeToArray(arr, len) {
      if (len == null || len > arr.length) len = arr.length;
      for (var i = 0, arr2 = new Array(len); i < len; i++) {
        arr2[i] = arr[i];
      }
      return arr2;
    }
    function _defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }
    function _createClass(Constructor, protoProps, staticProps) {
      if (protoProps) _defineProperties(Constructor.prototype, protoProps);
      Object.defineProperty(Constructor, "prototype", { writable: false });
      return Constructor;
    }
    function _inheritsLoose(subClass, superClass) {
      subClass.prototype = Object.create(superClass.prototype);
      subClass.prototype.constructor = subClass;
      _setPrototypeOf(subClass, superClass);
    }
    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o2, p2) {
        o2.__proto__ = p2;
        return o2;
      };
      return _setPrototypeOf(o, p);
    }
    var Container = /* @__PURE__ */ function(_Node) {
      _inheritsLoose(Container2, _Node);
      function Container2(opts) {
        var _this;
        _this = _Node.call(this, opts) || this;
        if (!_this.nodes) {
          _this.nodes = [];
        }
        return _this;
      }
      var _proto = Container2.prototype;
      _proto.append = function append(selector2) {
        selector2.parent = this;
        this.nodes.push(selector2);
        return this;
      };
      _proto.prepend = function prepend(selector2) {
        selector2.parent = this;
        this.nodes.unshift(selector2);
        for (var id2 in this.indexes) {
          this.indexes[id2]++;
        }
        return this;
      };
      _proto.at = function at(index) {
        return this.nodes[index];
      };
      _proto.index = function index(child) {
        if (typeof child === "number") {
          return child;
        }
        return this.nodes.indexOf(child);
      };
      _proto.removeChild = function removeChild(child) {
        child = this.index(child);
        this.at(child).parent = void 0;
        this.nodes.splice(child, 1);
        var index;
        for (var id2 in this.indexes) {
          index = this.indexes[id2];
          if (index >= child) {
            this.indexes[id2] = index - 1;
          }
        }
        return this;
      };
      _proto.removeAll = function removeAll() {
        for (var _iterator = _createForOfIteratorHelperLoose(this.nodes), _step; !(_step = _iterator()).done; ) {
          var node2 = _step.value;
          node2.parent = void 0;
        }
        this.nodes = [];
        return this;
      };
      _proto.empty = function empty() {
        return this.removeAll();
      };
      _proto.insertAfter = function insertAfter(oldNode, newNode) {
        var _this$nodes;
        newNode.parent = this;
        var oldIndex = this.index(oldNode);
        var resetNode = [];
        for (var i = 2; i < arguments.length; i++) {
          resetNode.push(arguments[i]);
        }
        (_this$nodes = this.nodes).splice.apply(_this$nodes, [oldIndex + 1, 0, newNode].concat(resetNode));
        newNode.parent = this;
        var index;
        for (var id2 in this.indexes) {
          index = this.indexes[id2];
          if (oldIndex < index) {
            this.indexes[id2] = index + arguments.length - 1;
          }
        }
        return this;
      };
      _proto.insertBefore = function insertBefore(oldNode, newNode) {
        var _this$nodes2;
        newNode.parent = this;
        var oldIndex = this.index(oldNode);
        var resetNode = [];
        for (var i = 2; i < arguments.length; i++) {
          resetNode.push(arguments[i]);
        }
        (_this$nodes2 = this.nodes).splice.apply(_this$nodes2, [oldIndex, 0, newNode].concat(resetNode));
        newNode.parent = this;
        var index;
        for (var id2 in this.indexes) {
          index = this.indexes[id2];
          if (index >= oldIndex) {
            this.indexes[id2] = index + arguments.length - 1;
          }
        }
        return this;
      };
      _proto._findChildAtPosition = function _findChildAtPosition(line, col) {
        var found = void 0;
        this.each(function(node2) {
          if (node2.atPosition) {
            var foundChild = node2.atPosition(line, col);
            if (foundChild) {
              found = foundChild;
              return false;
            }
          } else if (node2.isAtPosition(line, col)) {
            found = node2;
            return false;
          }
        });
        return found;
      };
      _proto.atPosition = function atPosition(line, col) {
        if (this.isAtPosition(line, col)) {
          return this._findChildAtPosition(line, col) || this;
        } else {
          return void 0;
        }
      };
      _proto._inferEndPosition = function _inferEndPosition() {
        if (this.last && this.last.source && this.last.source.end) {
          this.source = this.source || {};
          this.source.end = this.source.end || {};
          Object.assign(this.source.end, this.last.source.end);
        }
      };
      _proto.each = function each(callback) {
        if (!this.lastEach) {
          this.lastEach = 0;
        }
        if (!this.indexes) {
          this.indexes = {};
        }
        this.lastEach++;
        var id2 = this.lastEach;
        this.indexes[id2] = 0;
        if (!this.length) {
          return void 0;
        }
        var index, result2;
        while (this.indexes[id2] < this.length) {
          index = this.indexes[id2];
          result2 = callback(this.at(index), index);
          if (result2 === false) {
            break;
          }
          this.indexes[id2] += 1;
        }
        delete this.indexes[id2];
        if (result2 === false) {
          return false;
        }
      };
      _proto.walk = function walk2(callback) {
        return this.each(function(node2, i) {
          var result2 = callback(node2, i);
          if (result2 !== false && node2.length) {
            result2 = node2.walk(callback);
          }
          if (result2 === false) {
            return false;
          }
        });
      };
      _proto.walkAttributes = function walkAttributes(callback) {
        var _this2 = this;
        return this.walk(function(selector2) {
          if (selector2.type === types2.ATTRIBUTE) {
            return callback.call(_this2, selector2);
          }
        });
      };
      _proto.walkClasses = function walkClasses(callback) {
        var _this3 = this;
        return this.walk(function(selector2) {
          if (selector2.type === types2.CLASS) {
            return callback.call(_this3, selector2);
          }
        });
      };
      _proto.walkCombinators = function walkCombinators(callback) {
        var _this4 = this;
        return this.walk(function(selector2) {
          if (selector2.type === types2.COMBINATOR) {
            return callback.call(_this4, selector2);
          }
        });
      };
      _proto.walkComments = function walkComments(callback) {
        var _this5 = this;
        return this.walk(function(selector2) {
          if (selector2.type === types2.COMMENT) {
            return callback.call(_this5, selector2);
          }
        });
      };
      _proto.walkIds = function walkIds(callback) {
        var _this6 = this;
        return this.walk(function(selector2) {
          if (selector2.type === types2.ID) {
            return callback.call(_this6, selector2);
          }
        });
      };
      _proto.walkNesting = function walkNesting(callback) {
        var _this7 = this;
        return this.walk(function(selector2) {
          if (selector2.type === types2.NESTING) {
            return callback.call(_this7, selector2);
          }
        });
      };
      _proto.walkPseudos = function walkPseudos(callback) {
        var _this8 = this;
        return this.walk(function(selector2) {
          if (selector2.type === types2.PSEUDO) {
            return callback.call(_this8, selector2);
          }
        });
      };
      _proto.walkTags = function walkTags(callback) {
        var _this9 = this;
        return this.walk(function(selector2) {
          if (selector2.type === types2.TAG) {
            return callback.call(_this9, selector2);
          }
        });
      };
      _proto.walkUniversals = function walkUniversals(callback) {
        var _this10 = this;
        return this.walk(function(selector2) {
          if (selector2.type === types2.UNIVERSAL) {
            return callback.call(_this10, selector2);
          }
        });
      };
      _proto.split = function split(callback) {
        var _this11 = this;
        var current = [];
        return this.reduce(function(memo, node2, index) {
          var split2 = callback.call(_this11, node2);
          current.push(node2);
          if (split2) {
            memo.push(current);
            current = [];
          } else if (index === _this11.length - 1) {
            memo.push(current);
          }
          return memo;
        }, []);
      };
      _proto.map = function map(callback) {
        return this.nodes.map(callback);
      };
      _proto.reduce = function reduce(callback, memo) {
        return this.nodes.reduce(callback, memo);
      };
      _proto.every = function every(callback) {
        return this.nodes.every(callback);
      };
      _proto.some = function some(callback) {
        return this.nodes.some(callback);
      };
      _proto.filter = function filter(callback) {
        return this.nodes.filter(callback);
      };
      _proto.sort = function sort(callback) {
        return this.nodes.sort(callback);
      };
      _proto.toString = function toString() {
        return this.map(String).join("");
      };
      _createClass(Container2, [{
        key: "first",
        get: function get() {
          return this.at(0);
        }
      }, {
        key: "last",
        get: function get() {
          return this.at(this.length - 1);
        }
      }, {
        key: "length",
        get: function get() {
          return this.nodes.length;
        }
      }]);
      return Container2;
    }(_node["default"]);
    exports["default"] = Container;
    module.exports = exports.default;
  })(container, container.exports);
  return container.exports;
}
var hasRequiredRoot;
function requireRoot() {
  if (hasRequiredRoot) return root.exports;
  hasRequiredRoot = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _container = _interopRequireDefault(requireContainer());
    var _types = requireTypes();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    function _defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }
    function _createClass(Constructor, protoProps, staticProps) {
      if (protoProps) _defineProperties(Constructor.prototype, protoProps);
      Object.defineProperty(Constructor, "prototype", { writable: false });
      return Constructor;
    }
    function _inheritsLoose(subClass, superClass) {
      subClass.prototype = Object.create(superClass.prototype);
      subClass.prototype.constructor = subClass;
      _setPrototypeOf(subClass, superClass);
    }
    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o2, p2) {
        o2.__proto__ = p2;
        return o2;
      };
      return _setPrototypeOf(o, p);
    }
    var Root = /* @__PURE__ */ function(_Container) {
      _inheritsLoose(Root2, _Container);
      function Root2(opts) {
        var _this;
        _this = _Container.call(this, opts) || this;
        _this.type = _types.ROOT;
        return _this;
      }
      var _proto = Root2.prototype;
      _proto.toString = function toString() {
        var str = this.reduce(function(memo, selector2) {
          memo.push(String(selector2));
          return memo;
        }, []).join(",");
        return this.trailingComma ? str + "," : str;
      };
      _proto.error = function error(message, options) {
        if (this._error) {
          return this._error(message, options);
        } else {
          return new Error(message);
        }
      };
      _createClass(Root2, [{
        key: "errorGenerator",
        set: function set(handler) {
          this._error = handler;
        }
      }]);
      return Root2;
    }(_container["default"]);
    exports["default"] = Root;
    module.exports = exports.default;
  })(root, root.exports);
  return root.exports;
}
var selector = { exports: {} };
var hasRequiredSelector;
function requireSelector() {
  if (hasRequiredSelector) return selector.exports;
  hasRequiredSelector = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _container = _interopRequireDefault(requireContainer());
    var _types = requireTypes();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    function _inheritsLoose(subClass, superClass) {
      subClass.prototype = Object.create(superClass.prototype);
      subClass.prototype.constructor = subClass;
      _setPrototypeOf(subClass, superClass);
    }
    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o2, p2) {
        o2.__proto__ = p2;
        return o2;
      };
      return _setPrototypeOf(o, p);
    }
    var Selector = /* @__PURE__ */ function(_Container) {
      _inheritsLoose(Selector2, _Container);
      function Selector2(opts) {
        var _this;
        _this = _Container.call(this, opts) || this;
        _this.type = _types.SELECTOR;
        return _this;
      }
      return Selector2;
    }(_container["default"]);
    exports["default"] = Selector;
    module.exports = exports.default;
  })(selector, selector.exports);
  return selector.exports;
}
var className = { exports: {} };
/*! https://mths.be/cssesc v3.0.0 by @mathias */
var cssesc_1;
var hasRequiredCssesc;
function requireCssesc() {
  if (hasRequiredCssesc) return cssesc_1;
  hasRequiredCssesc = 1;
  var object = {};
  var hasOwnProperty = object.hasOwnProperty;
  var merge = function merge2(options, defaults) {
    if (!options) {
      return defaults;
    }
    var result2 = {};
    for (var key in defaults) {
      result2[key] = hasOwnProperty.call(options, key) ? options[key] : defaults[key];
    }
    return result2;
  };
  var regexAnySingleEscape = /[ -,\.\/:-@\[-\^`\{-~]/;
  var regexSingleEscape = /[ -,\.\/:-@\[\]\^`\{-~]/;
  var regexExcessiveSpaces = /(^|\\+)?(\\[A-F0-9]{1,6})\x20(?![a-fA-F0-9\x20])/g;
  var cssesc = function cssesc2(string2, options) {
    options = merge(options, cssesc2.options);
    if (options.quotes != "single" && options.quotes != "double") {
      options.quotes = "single";
    }
    var quote = options.quotes == "double" ? '"' : "'";
    var isIdentifier = options.isIdentifier;
    var firstChar = string2.charAt(0);
    var output = "";
    var counter = 0;
    var length = string2.length;
    while (counter < length) {
      var character = string2.charAt(counter++);
      var codePoint = character.charCodeAt();
      var value = void 0;
      if (codePoint < 32 || codePoint > 126) {
        if (codePoint >= 55296 && codePoint <= 56319 && counter < length) {
          var extra = string2.charCodeAt(counter++);
          if ((extra & 64512) == 56320) {
            codePoint = ((codePoint & 1023) << 10) + (extra & 1023) + 65536;
          } else {
            counter--;
          }
        }
        value = "\\" + codePoint.toString(16).toUpperCase() + " ";
      } else {
        if (options.escapeEverything) {
          if (regexAnySingleEscape.test(character)) {
            value = "\\" + character;
          } else {
            value = "\\" + codePoint.toString(16).toUpperCase() + " ";
          }
        } else if (/[\t\n\f\r\x0B]/.test(character)) {
          value = "\\" + codePoint.toString(16).toUpperCase() + " ";
        } else if (character == "\\" || !isIdentifier && (character == '"' && quote == character || character == "'" && quote == character) || isIdentifier && regexSingleEscape.test(character)) {
          value = "\\" + character;
        } else {
          value = character;
        }
      }
      output += value;
    }
    if (isIdentifier) {
      if (/^-[-\d]/.test(output)) {
        output = "\\-" + output.slice(1);
      } else if (/\d/.test(firstChar)) {
        output = "\\3" + firstChar + " " + output.slice(1);
      }
    }
    output = output.replace(regexExcessiveSpaces, function($0, $1, $2) {
      if ($1 && $1.length % 2) {
        return $0;
      }
      return ($1 || "") + $2;
    });
    if (!isIdentifier && options.wrap) {
      return quote + output + quote;
    }
    return output;
  };
  cssesc.options = {
    "escapeEverything": false,
    "isIdentifier": false,
    "quotes": "single",
    "wrap": false
  };
  cssesc.version = "3.0.0";
  cssesc_1 = cssesc;
  return cssesc_1;
}
var hasRequiredClassName;
function requireClassName() {
  if (hasRequiredClassName) return className.exports;
  hasRequiredClassName = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _cssesc = _interopRequireDefault(requireCssesc());
    var _util = requireUtil();
    var _node = _interopRequireDefault(requireNode());
    var _types = requireTypes();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    function _defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }
    function _createClass(Constructor, protoProps, staticProps) {
      if (protoProps) _defineProperties(Constructor.prototype, protoProps);
      Object.defineProperty(Constructor, "prototype", { writable: false });
      return Constructor;
    }
    function _inheritsLoose(subClass, superClass) {
      subClass.prototype = Object.create(superClass.prototype);
      subClass.prototype.constructor = subClass;
      _setPrototypeOf(subClass, superClass);
    }
    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o2, p2) {
        o2.__proto__ = p2;
        return o2;
      };
      return _setPrototypeOf(o, p);
    }
    var ClassName = /* @__PURE__ */ function(_Node) {
      _inheritsLoose(ClassName2, _Node);
      function ClassName2(opts) {
        var _this;
        _this = _Node.call(this, opts) || this;
        _this.type = _types.CLASS;
        _this._constructed = true;
        return _this;
      }
      var _proto = ClassName2.prototype;
      _proto.valueToString = function valueToString() {
        return "." + _Node.prototype.valueToString.call(this);
      };
      _createClass(ClassName2, [{
        key: "value",
        get: function get() {
          return this._value;
        },
        set: function set(v) {
          if (this._constructed) {
            var escaped = (0, _cssesc["default"])(v, {
              isIdentifier: true
            });
            if (escaped !== v) {
              (0, _util.ensureObject)(this, "raws");
              this.raws.value = escaped;
            } else if (this.raws) {
              delete this.raws.value;
            }
          }
          this._value = v;
        }
      }]);
      return ClassName2;
    }(_node["default"]);
    exports["default"] = ClassName;
    module.exports = exports.default;
  })(className, className.exports);
  return className.exports;
}
var comment = { exports: {} };
var hasRequiredComment;
function requireComment() {
  if (hasRequiredComment) return comment.exports;
  hasRequiredComment = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _node = _interopRequireDefault(requireNode());
    var _types = requireTypes();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    function _inheritsLoose(subClass, superClass) {
      subClass.prototype = Object.create(superClass.prototype);
      subClass.prototype.constructor = subClass;
      _setPrototypeOf(subClass, superClass);
    }
    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o2, p2) {
        o2.__proto__ = p2;
        return o2;
      };
      return _setPrototypeOf(o, p);
    }
    var Comment = /* @__PURE__ */ function(_Node) {
      _inheritsLoose(Comment2, _Node);
      function Comment2(opts) {
        var _this;
        _this = _Node.call(this, opts) || this;
        _this.type = _types.COMMENT;
        return _this;
      }
      return Comment2;
    }(_node["default"]);
    exports["default"] = Comment;
    module.exports = exports.default;
  })(comment, comment.exports);
  return comment.exports;
}
var id = { exports: {} };
var hasRequiredId;
function requireId() {
  if (hasRequiredId) return id.exports;
  hasRequiredId = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _node = _interopRequireDefault(requireNode());
    var _types = requireTypes();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    function _inheritsLoose(subClass, superClass) {
      subClass.prototype = Object.create(superClass.prototype);
      subClass.prototype.constructor = subClass;
      _setPrototypeOf(subClass, superClass);
    }
    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o2, p2) {
        o2.__proto__ = p2;
        return o2;
      };
      return _setPrototypeOf(o, p);
    }
    var ID = /* @__PURE__ */ function(_Node) {
      _inheritsLoose(ID2, _Node);
      function ID2(opts) {
        var _this;
        _this = _Node.call(this, opts) || this;
        _this.type = _types.ID;
        return _this;
      }
      var _proto = ID2.prototype;
      _proto.valueToString = function valueToString() {
        return "#" + _Node.prototype.valueToString.call(this);
      };
      return ID2;
    }(_node["default"]);
    exports["default"] = ID;
    module.exports = exports.default;
  })(id, id.exports);
  return id.exports;
}
var tag = { exports: {} };
var namespace = { exports: {} };
var hasRequiredNamespace;
function requireNamespace() {
  if (hasRequiredNamespace) return namespace.exports;
  hasRequiredNamespace = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _cssesc = _interopRequireDefault(requireCssesc());
    var _util = requireUtil();
    var _node = _interopRequireDefault(requireNode());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    function _defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }
    function _createClass(Constructor, protoProps, staticProps) {
      if (protoProps) _defineProperties(Constructor.prototype, protoProps);
      Object.defineProperty(Constructor, "prototype", { writable: false });
      return Constructor;
    }
    function _inheritsLoose(subClass, superClass) {
      subClass.prototype = Object.create(superClass.prototype);
      subClass.prototype.constructor = subClass;
      _setPrototypeOf(subClass, superClass);
    }
    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o2, p2) {
        o2.__proto__ = p2;
        return o2;
      };
      return _setPrototypeOf(o, p);
    }
    var Namespace = /* @__PURE__ */ function(_Node) {
      _inheritsLoose(Namespace2, _Node);
      function Namespace2() {
        return _Node.apply(this, arguments) || this;
      }
      var _proto = Namespace2.prototype;
      _proto.qualifiedName = function qualifiedName(value) {
        if (this.namespace) {
          return this.namespaceString + "|" + value;
        } else {
          return value;
        }
      };
      _proto.valueToString = function valueToString() {
        return this.qualifiedName(_Node.prototype.valueToString.call(this));
      };
      _createClass(Namespace2, [{
        key: "namespace",
        get: function get() {
          return this._namespace;
        },
        set: function set(namespace2) {
          if (namespace2 === true || namespace2 === "*" || namespace2 === "&") {
            this._namespace = namespace2;
            if (this.raws) {
              delete this.raws.namespace;
            }
            return;
          }
          var escaped = (0, _cssesc["default"])(namespace2, {
            isIdentifier: true
          });
          this._namespace = namespace2;
          if (escaped !== namespace2) {
            (0, _util.ensureObject)(this, "raws");
            this.raws.namespace = escaped;
          } else if (this.raws) {
            delete this.raws.namespace;
          }
        }
      }, {
        key: "ns",
        get: function get() {
          return this._namespace;
        },
        set: function set(namespace2) {
          this.namespace = namespace2;
        }
      }, {
        key: "namespaceString",
        get: function get() {
          if (this.namespace) {
            var ns = this.stringifyProperty("namespace");
            if (ns === true) {
              return "";
            } else {
              return ns;
            }
          } else {
            return "";
          }
        }
      }]);
      return Namespace2;
    }(_node["default"]);
    exports["default"] = Namespace;
    module.exports = exports.default;
  })(namespace, namespace.exports);
  return namespace.exports;
}
var hasRequiredTag;
function requireTag() {
  if (hasRequiredTag) return tag.exports;
  hasRequiredTag = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _namespace = _interopRequireDefault(requireNamespace());
    var _types = requireTypes();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    function _inheritsLoose(subClass, superClass) {
      subClass.prototype = Object.create(superClass.prototype);
      subClass.prototype.constructor = subClass;
      _setPrototypeOf(subClass, superClass);
    }
    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o2, p2) {
        o2.__proto__ = p2;
        return o2;
      };
      return _setPrototypeOf(o, p);
    }
    var Tag = /* @__PURE__ */ function(_Namespace) {
      _inheritsLoose(Tag2, _Namespace);
      function Tag2(opts) {
        var _this;
        _this = _Namespace.call(this, opts) || this;
        _this.type = _types.TAG;
        return _this;
      }
      return Tag2;
    }(_namespace["default"]);
    exports["default"] = Tag;
    module.exports = exports.default;
  })(tag, tag.exports);
  return tag.exports;
}
var string = { exports: {} };
var hasRequiredString;
function requireString() {
  if (hasRequiredString) return string.exports;
  hasRequiredString = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _node = _interopRequireDefault(requireNode());
    var _types = requireTypes();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    function _inheritsLoose(subClass, superClass) {
      subClass.prototype = Object.create(superClass.prototype);
      subClass.prototype.constructor = subClass;
      _setPrototypeOf(subClass, superClass);
    }
    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o2, p2) {
        o2.__proto__ = p2;
        return o2;
      };
      return _setPrototypeOf(o, p);
    }
    var String2 = /* @__PURE__ */ function(_Node) {
      _inheritsLoose(String3, _Node);
      function String3(opts) {
        var _this;
        _this = _Node.call(this, opts) || this;
        _this.type = _types.STRING;
        return _this;
      }
      return String3;
    }(_node["default"]);
    exports["default"] = String2;
    module.exports = exports.default;
  })(string, string.exports);
  return string.exports;
}
var pseudo = { exports: {} };
var hasRequiredPseudo;
function requirePseudo() {
  if (hasRequiredPseudo) return pseudo.exports;
  hasRequiredPseudo = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _container = _interopRequireDefault(requireContainer());
    var _types = requireTypes();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    function _inheritsLoose(subClass, superClass) {
      subClass.prototype = Object.create(superClass.prototype);
      subClass.prototype.constructor = subClass;
      _setPrototypeOf(subClass, superClass);
    }
    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o2, p2) {
        o2.__proto__ = p2;
        return o2;
      };
      return _setPrototypeOf(o, p);
    }
    var Pseudo = /* @__PURE__ */ function(_Container) {
      _inheritsLoose(Pseudo2, _Container);
      function Pseudo2(opts) {
        var _this;
        _this = _Container.call(this, opts) || this;
        _this.type = _types.PSEUDO;
        return _this;
      }
      var _proto = Pseudo2.prototype;
      _proto.toString = function toString() {
        var params = this.length ? "(" + this.map(String).join(",") + ")" : "";
        return [this.rawSpaceBefore, this.stringifyProperty("value"), params, this.rawSpaceAfter].join("");
      };
      return Pseudo2;
    }(_container["default"]);
    exports["default"] = Pseudo;
    module.exports = exports.default;
  })(pseudo, pseudo.exports);
  return pseudo.exports;
}
var attribute = {};
var browser;
var hasRequiredBrowser;
function requireBrowser() {
  if (hasRequiredBrowser) return browser;
  hasRequiredBrowser = 1;
  browser = deprecate;
  function deprecate(fn, msg) {
    if (config("noDeprecation")) {
      return fn;
    }
    var warned = false;
    function deprecated() {
      if (!warned) {
        if (config("throwDeprecation")) {
          throw new Error(msg);
        } else if (config("traceDeprecation")) {
          console.trace(msg);
        } else {
          console.warn(msg);
        }
        warned = true;
      }
      return fn.apply(this, arguments);
    }
    return deprecated;
  }
  function config(name) {
    try {
      if (!commonjsGlobal.localStorage) return false;
    } catch (_) {
      return false;
    }
    var val = commonjsGlobal.localStorage[name];
    if (null == val) return false;
    return String(val).toLowerCase() === "true";
  }
  return browser;
}
var hasRequiredAttribute;
function requireAttribute() {
  if (hasRequiredAttribute) return attribute;
  hasRequiredAttribute = 1;
  (function(exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    exports.unescapeValue = unescapeValue;
    var _cssesc = _interopRequireDefault(requireCssesc());
    var _unesc = _interopRequireDefault(requireUnesc());
    var _namespace = _interopRequireDefault(requireNamespace());
    var _types = requireTypes();
    var _CSSESC_QUOTE_OPTIONS;
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    function _defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }
    function _createClass(Constructor, protoProps, staticProps) {
      if (protoProps) _defineProperties(Constructor.prototype, protoProps);
      Object.defineProperty(Constructor, "prototype", { writable: false });
      return Constructor;
    }
    function _inheritsLoose(subClass, superClass) {
      subClass.prototype = Object.create(superClass.prototype);
      subClass.prototype.constructor = subClass;
      _setPrototypeOf(subClass, superClass);
    }
    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o2, p2) {
        o2.__proto__ = p2;
        return o2;
      };
      return _setPrototypeOf(o, p);
    }
    var deprecate = requireBrowser();
    var WRAPPED_IN_QUOTES = /^('|")([^]*)\1$/;
    var warnOfDeprecatedValueAssignment = deprecate(function() {
    }, "Assigning an attribute a value containing characters that might need to be escaped is deprecated. Call attribute.setValue() instead.");
    var warnOfDeprecatedQuotedAssignment = deprecate(function() {
    }, "Assigning attr.quoted is deprecated and has no effect. Assign to attr.quoteMark instead.");
    var warnOfDeprecatedConstructor = deprecate(function() {
    }, "Constructing an Attribute selector with a value without specifying quoteMark is deprecated. Note: The value should be unescaped now.");
    function unescapeValue(value) {
      var deprecatedUsage = false;
      var quoteMark = null;
      var unescaped = value;
      var m = unescaped.match(WRAPPED_IN_QUOTES);
      if (m) {
        quoteMark = m[1];
        unescaped = m[2];
      }
      unescaped = (0, _unesc["default"])(unescaped);
      if (unescaped !== value) {
        deprecatedUsage = true;
      }
      return {
        deprecatedUsage,
        unescaped,
        quoteMark
      };
    }
    function handleDeprecatedContructorOpts(opts) {
      if (opts.quoteMark !== void 0) {
        return opts;
      }
      if (opts.value === void 0) {
        return opts;
      }
      warnOfDeprecatedConstructor();
      var _unescapeValue = unescapeValue(opts.value), quoteMark = _unescapeValue.quoteMark, unescaped = _unescapeValue.unescaped;
      if (!opts.raws) {
        opts.raws = {};
      }
      if (opts.raws.value === void 0) {
        opts.raws.value = opts.value;
      }
      opts.value = unescaped;
      opts.quoteMark = quoteMark;
      return opts;
    }
    var Attribute = /* @__PURE__ */ function(_Namespace) {
      _inheritsLoose(Attribute2, _Namespace);
      function Attribute2(opts) {
        var _this;
        if (opts === void 0) {
          opts = {};
        }
        _this = _Namespace.call(this, handleDeprecatedContructorOpts(opts)) || this;
        _this.type = _types.ATTRIBUTE;
        _this.raws = _this.raws || {};
        Object.defineProperty(_this.raws, "unquoted", {
          get: deprecate(function() {
            return _this.value;
          }, "attr.raws.unquoted is deprecated. Call attr.value instead."),
          set: deprecate(function() {
            return _this.value;
          }, "Setting attr.raws.unquoted is deprecated and has no effect. attr.value is unescaped by default now.")
        });
        _this._constructed = true;
        return _this;
      }
      var _proto = Attribute2.prototype;
      _proto.getQuotedValue = function getQuotedValue(options) {
        if (options === void 0) {
          options = {};
        }
        var quoteMark = this._determineQuoteMark(options);
        var cssescopts = CSSESC_QUOTE_OPTIONS[quoteMark];
        var escaped = (0, _cssesc["default"])(this._value, cssescopts);
        return escaped;
      };
      _proto._determineQuoteMark = function _determineQuoteMark(options) {
        return options.smart ? this.smartQuoteMark(options) : this.preferredQuoteMark(options);
      };
      _proto.setValue = function setValue(value, options) {
        if (options === void 0) {
          options = {};
        }
        this._value = value;
        this._quoteMark = this._determineQuoteMark(options);
        this._syncRawValue();
      };
      _proto.smartQuoteMark = function smartQuoteMark(options) {
        var v = this.value;
        var numSingleQuotes = v.replace(/[^']/g, "").length;
        var numDoubleQuotes = v.replace(/[^"]/g, "").length;
        if (numSingleQuotes + numDoubleQuotes === 0) {
          var escaped = (0, _cssesc["default"])(v, {
            isIdentifier: true
          });
          if (escaped === v) {
            return Attribute2.NO_QUOTE;
          } else {
            var pref = this.preferredQuoteMark(options);
            if (pref === Attribute2.NO_QUOTE) {
              var quote = this.quoteMark || options.quoteMark || Attribute2.DOUBLE_QUOTE;
              var opts = CSSESC_QUOTE_OPTIONS[quote];
              var quoteValue = (0, _cssesc["default"])(v, opts);
              if (quoteValue.length < escaped.length) {
                return quote;
              }
            }
            return pref;
          }
        } else if (numDoubleQuotes === numSingleQuotes) {
          return this.preferredQuoteMark(options);
        } else if (numDoubleQuotes < numSingleQuotes) {
          return Attribute2.DOUBLE_QUOTE;
        } else {
          return Attribute2.SINGLE_QUOTE;
        }
      };
      _proto.preferredQuoteMark = function preferredQuoteMark(options) {
        var quoteMark = options.preferCurrentQuoteMark ? this.quoteMark : options.quoteMark;
        if (quoteMark === void 0) {
          quoteMark = options.preferCurrentQuoteMark ? options.quoteMark : this.quoteMark;
        }
        if (quoteMark === void 0) {
          quoteMark = Attribute2.DOUBLE_QUOTE;
        }
        return quoteMark;
      };
      _proto._syncRawValue = function _syncRawValue() {
        var rawValue = (0, _cssesc["default"])(this._value, CSSESC_QUOTE_OPTIONS[this.quoteMark]);
        if (rawValue === this._value) {
          if (this.raws) {
            delete this.raws.value;
          }
        } else {
          this.raws.value = rawValue;
        }
      };
      _proto._handleEscapes = function _handleEscapes(prop, value) {
        if (this._constructed) {
          var escaped = (0, _cssesc["default"])(value, {
            isIdentifier: true
          });
          if (escaped !== value) {
            this.raws[prop] = escaped;
          } else {
            delete this.raws[prop];
          }
        }
      };
      _proto._spacesFor = function _spacesFor(name) {
        var attrSpaces = {
          before: "",
          after: ""
        };
        var spaces = this.spaces[name] || {};
        var rawSpaces = this.raws.spaces && this.raws.spaces[name] || {};
        return Object.assign(attrSpaces, spaces, rawSpaces);
      };
      _proto._stringFor = function _stringFor(name, spaceName, concat) {
        if (spaceName === void 0) {
          spaceName = name;
        }
        if (concat === void 0) {
          concat = defaultAttrConcat;
        }
        var attrSpaces = this._spacesFor(spaceName);
        return concat(this.stringifyProperty(name), attrSpaces);
      };
      _proto.offsetOf = function offsetOf(name) {
        var count = 1;
        var attributeSpaces = this._spacesFor("attribute");
        count += attributeSpaces.before.length;
        if (name === "namespace" || name === "ns") {
          return this.namespace ? count : -1;
        }
        if (name === "attributeNS") {
          return count;
        }
        count += this.namespaceString.length;
        if (this.namespace) {
          count += 1;
        }
        if (name === "attribute") {
          return count;
        }
        count += this.stringifyProperty("attribute").length;
        count += attributeSpaces.after.length;
        var operatorSpaces = this._spacesFor("operator");
        count += operatorSpaces.before.length;
        var operator = this.stringifyProperty("operator");
        if (name === "operator") {
          return operator ? count : -1;
        }
        count += operator.length;
        count += operatorSpaces.after.length;
        var valueSpaces = this._spacesFor("value");
        count += valueSpaces.before.length;
        var value = this.stringifyProperty("value");
        if (name === "value") {
          return value ? count : -1;
        }
        count += value.length;
        count += valueSpaces.after.length;
        var insensitiveSpaces = this._spacesFor("insensitive");
        count += insensitiveSpaces.before.length;
        if (name === "insensitive") {
          return this.insensitive ? count : -1;
        }
        return -1;
      };
      _proto.toString = function toString() {
        var _this2 = this;
        var selector2 = [this.rawSpaceBefore, "["];
        selector2.push(this._stringFor("qualifiedAttribute", "attribute"));
        if (this.operator && (this.value || this.value === "")) {
          selector2.push(this._stringFor("operator"));
          selector2.push(this._stringFor("value"));
          selector2.push(this._stringFor("insensitiveFlag", "insensitive", function(attrValue, attrSpaces) {
            if (attrValue.length > 0 && !_this2.quoted && attrSpaces.before.length === 0 && !(_this2.spaces.value && _this2.spaces.value.after)) {
              attrSpaces.before = " ";
            }
            return defaultAttrConcat(attrValue, attrSpaces);
          }));
        }
        selector2.push("]");
        selector2.push(this.rawSpaceAfter);
        return selector2.join("");
      };
      _createClass(Attribute2, [{
        key: "quoted",
        get: function get() {
          var qm = this.quoteMark;
          return qm === "'" || qm === '"';
        },
        set: function set(value) {
          warnOfDeprecatedQuotedAssignment();
        }
        /**
         * returns a single (`'`) or double (`"`) quote character if the value is quoted.
         * returns `null` if the value is not quoted.
         * returns `undefined` if the quotation state is unknown (this can happen when
         * the attribute is constructed without specifying a quote mark.)
         */
      }, {
        key: "quoteMark",
        get: function get() {
          return this._quoteMark;
        },
        set: function set(quoteMark) {
          if (!this._constructed) {
            this._quoteMark = quoteMark;
            return;
          }
          if (this._quoteMark !== quoteMark) {
            this._quoteMark = quoteMark;
            this._syncRawValue();
          }
        }
      }, {
        key: "qualifiedAttribute",
        get: function get() {
          return this.qualifiedName(this.raws.attribute || this.attribute);
        }
      }, {
        key: "insensitiveFlag",
        get: function get() {
          return this.insensitive ? "i" : "";
        }
      }, {
        key: "value",
        get: function get() {
          return this._value;
        },
        set: (
          /**
           * Before 3.0, the value had to be set to an escaped value including any wrapped
           * quote marks. In 3.0, the semantics of `Attribute.value` changed so that the value
           * is unescaped during parsing and any quote marks are removed.
           *
           * Because the ambiguity of this semantic change, if you set `attr.value = newValue`,
           * a deprecation warning is raised when the new value contains any characters that would
           * require escaping (including if it contains wrapped quotes).
           *
           * Instead, you should call `attr.setValue(newValue, opts)` and pass options that describe
           * how the new value is quoted.
           */
          function set(v) {
            if (this._constructed) {
              var _unescapeValue2 = unescapeValue(v), deprecatedUsage = _unescapeValue2.deprecatedUsage, unescaped = _unescapeValue2.unescaped, quoteMark = _unescapeValue2.quoteMark;
              if (deprecatedUsage) {
                warnOfDeprecatedValueAssignment();
              }
              if (unescaped === this._value && quoteMark === this._quoteMark) {
                return;
              }
              this._value = unescaped;
              this._quoteMark = quoteMark;
              this._syncRawValue();
            } else {
              this._value = v;
            }
          }
        )
      }, {
        key: "insensitive",
        get: function get() {
          return this._insensitive;
        },
        set: function set(insensitive) {
          if (!insensitive) {
            this._insensitive = false;
            if (this.raws && (this.raws.insensitiveFlag === "I" || this.raws.insensitiveFlag === "i")) {
              this.raws.insensitiveFlag = void 0;
            }
          }
          this._insensitive = insensitive;
        }
      }, {
        key: "attribute",
        get: function get() {
          return this._attribute;
        },
        set: function set(name) {
          this._handleEscapes("attribute", name);
          this._attribute = name;
        }
      }]);
      return Attribute2;
    }(_namespace["default"]);
    exports["default"] = Attribute;
    Attribute.NO_QUOTE = null;
    Attribute.SINGLE_QUOTE = "'";
    Attribute.DOUBLE_QUOTE = '"';
    var CSSESC_QUOTE_OPTIONS = (_CSSESC_QUOTE_OPTIONS = {
      "'": {
        quotes: "single",
        wrap: true
      },
      '"': {
        quotes: "double",
        wrap: true
      }
    }, _CSSESC_QUOTE_OPTIONS[null] = {
      isIdentifier: true
    }, _CSSESC_QUOTE_OPTIONS);
    function defaultAttrConcat(attrValue, attrSpaces) {
      return "" + attrSpaces.before + attrValue + attrSpaces.after;
    }
  })(attribute);
  return attribute;
}
var universal = { exports: {} };
var hasRequiredUniversal;
function requireUniversal() {
  if (hasRequiredUniversal) return universal.exports;
  hasRequiredUniversal = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _namespace = _interopRequireDefault(requireNamespace());
    var _types = requireTypes();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    function _inheritsLoose(subClass, superClass) {
      subClass.prototype = Object.create(superClass.prototype);
      subClass.prototype.constructor = subClass;
      _setPrototypeOf(subClass, superClass);
    }
    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o2, p2) {
        o2.__proto__ = p2;
        return o2;
      };
      return _setPrototypeOf(o, p);
    }
    var Universal = /* @__PURE__ */ function(_Namespace) {
      _inheritsLoose(Universal2, _Namespace);
      function Universal2(opts) {
        var _this;
        _this = _Namespace.call(this, opts) || this;
        _this.type = _types.UNIVERSAL;
        _this.value = "*";
        return _this;
      }
      return Universal2;
    }(_namespace["default"]);
    exports["default"] = Universal;
    module.exports = exports.default;
  })(universal, universal.exports);
  return universal.exports;
}
var combinator = { exports: {} };
var hasRequiredCombinator;
function requireCombinator() {
  if (hasRequiredCombinator) return combinator.exports;
  hasRequiredCombinator = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _node = _interopRequireDefault(requireNode());
    var _types = requireTypes();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    function _inheritsLoose(subClass, superClass) {
      subClass.prototype = Object.create(superClass.prototype);
      subClass.prototype.constructor = subClass;
      _setPrototypeOf(subClass, superClass);
    }
    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o2, p2) {
        o2.__proto__ = p2;
        return o2;
      };
      return _setPrototypeOf(o, p);
    }
    var Combinator = /* @__PURE__ */ function(_Node) {
      _inheritsLoose(Combinator2, _Node);
      function Combinator2(opts) {
        var _this;
        _this = _Node.call(this, opts) || this;
        _this.type = _types.COMBINATOR;
        return _this;
      }
      return Combinator2;
    }(_node["default"]);
    exports["default"] = Combinator;
    module.exports = exports.default;
  })(combinator, combinator.exports);
  return combinator.exports;
}
var nesting = { exports: {} };
var hasRequiredNesting;
function requireNesting() {
  if (hasRequiredNesting) return nesting.exports;
  hasRequiredNesting = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _node = _interopRequireDefault(requireNode());
    var _types = requireTypes();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    function _inheritsLoose(subClass, superClass) {
      subClass.prototype = Object.create(superClass.prototype);
      subClass.prototype.constructor = subClass;
      _setPrototypeOf(subClass, superClass);
    }
    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o2, p2) {
        o2.__proto__ = p2;
        return o2;
      };
      return _setPrototypeOf(o, p);
    }
    var Nesting = /* @__PURE__ */ function(_Node) {
      _inheritsLoose(Nesting2, _Node);
      function Nesting2(opts) {
        var _this;
        _this = _Node.call(this, opts) || this;
        _this.type = _types.NESTING;
        _this.value = "&";
        return _this;
      }
      return Nesting2;
    }(_node["default"]);
    exports["default"] = Nesting;
    module.exports = exports.default;
  })(nesting, nesting.exports);
  return nesting.exports;
}
var sortAscending = { exports: {} };
var hasRequiredSortAscending;
function requireSortAscending() {
  if (hasRequiredSortAscending) return sortAscending.exports;
  hasRequiredSortAscending = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = sortAscending2;
    function sortAscending2(list) {
      return list.sort(function(a, b) {
        return a - b;
      });
    }
    module.exports = exports.default;
  })(sortAscending, sortAscending.exports);
  return sortAscending.exports;
}
var tokenize = {};
var tokenTypes = {};
var hasRequiredTokenTypes;
function requireTokenTypes() {
  if (hasRequiredTokenTypes) return tokenTypes;
  hasRequiredTokenTypes = 1;
  tokenTypes.__esModule = true;
  tokenTypes.word = tokenTypes.tilde = tokenTypes.tab = tokenTypes.str = tokenTypes.space = tokenTypes.slash = tokenTypes.singleQuote = tokenTypes.semicolon = tokenTypes.plus = tokenTypes.pipe = tokenTypes.openSquare = tokenTypes.openParenthesis = tokenTypes.newline = tokenTypes.greaterThan = tokenTypes.feed = tokenTypes.equals = tokenTypes.doubleQuote = tokenTypes.dollar = tokenTypes.cr = tokenTypes.comment = tokenTypes.comma = tokenTypes.combinator = tokenTypes.colon = tokenTypes.closeSquare = tokenTypes.closeParenthesis = tokenTypes.caret = tokenTypes.bang = tokenTypes.backslash = tokenTypes.at = tokenTypes.asterisk = tokenTypes.ampersand = void 0;
  var ampersand = 38;
  tokenTypes.ampersand = ampersand;
  var asterisk = 42;
  tokenTypes.asterisk = asterisk;
  var at = 64;
  tokenTypes.at = at;
  var comma = 44;
  tokenTypes.comma = comma;
  var colon = 58;
  tokenTypes.colon = colon;
  var semicolon = 59;
  tokenTypes.semicolon = semicolon;
  var openParenthesis = 40;
  tokenTypes.openParenthesis = openParenthesis;
  var closeParenthesis = 41;
  tokenTypes.closeParenthesis = closeParenthesis;
  var openSquare = 91;
  tokenTypes.openSquare = openSquare;
  var closeSquare = 93;
  tokenTypes.closeSquare = closeSquare;
  var dollar = 36;
  tokenTypes.dollar = dollar;
  var tilde = 126;
  tokenTypes.tilde = tilde;
  var caret = 94;
  tokenTypes.caret = caret;
  var plus = 43;
  tokenTypes.plus = plus;
  var equals = 61;
  tokenTypes.equals = equals;
  var pipe = 124;
  tokenTypes.pipe = pipe;
  var greaterThan = 62;
  tokenTypes.greaterThan = greaterThan;
  var space = 32;
  tokenTypes.space = space;
  var singleQuote = 39;
  tokenTypes.singleQuote = singleQuote;
  var doubleQuote = 34;
  tokenTypes.doubleQuote = doubleQuote;
  var slash = 47;
  tokenTypes.slash = slash;
  var bang = 33;
  tokenTypes.bang = bang;
  var backslash = 92;
  tokenTypes.backslash = backslash;
  var cr = 13;
  tokenTypes.cr = cr;
  var feed = 12;
  tokenTypes.feed = feed;
  var newline = 10;
  tokenTypes.newline = newline;
  var tab = 9;
  tokenTypes.tab = tab;
  var str = singleQuote;
  tokenTypes.str = str;
  var comment2 = -1;
  tokenTypes.comment = comment2;
  var word = -2;
  tokenTypes.word = word;
  var combinator2 = -3;
  tokenTypes.combinator = combinator2;
  return tokenTypes;
}
var hasRequiredTokenize;
function requireTokenize() {
  if (hasRequiredTokenize) return tokenize;
  hasRequiredTokenize = 1;
  (function(exports) {
    exports.__esModule = true;
    exports.FIELDS = void 0;
    exports["default"] = tokenize2;
    var t = _interopRequireWildcard(requireTokenTypes());
    var _unescapable, _wordDelimiters;
    function _getRequireWildcardCache(nodeInterop) {
      if (typeof WeakMap !== "function") return null;
      var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
      var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
      return (_getRequireWildcardCache = function _getRequireWildcardCache2(nodeInterop2) {
        return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
      })(nodeInterop);
    }
    function _interopRequireWildcard(obj, nodeInterop) {
      if (obj && obj.__esModule) {
        return obj;
      }
      if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return { "default": obj };
      }
      var cache = _getRequireWildcardCache(nodeInterop);
      if (cache && cache.has(obj)) {
        return cache.get(obj);
      }
      var newObj = {};
      var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
      for (var key in obj) {
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
          var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
          if (desc && (desc.get || desc.set)) {
            Object.defineProperty(newObj, key, desc);
          } else {
            newObj[key] = obj[key];
          }
        }
      }
      newObj["default"] = obj;
      if (cache) {
        cache.set(obj, newObj);
      }
      return newObj;
    }
    var unescapable = (_unescapable = {}, _unescapable[t.tab] = true, _unescapable[t.newline] = true, _unescapable[t.cr] = true, _unescapable[t.feed] = true, _unescapable);
    var wordDelimiters = (_wordDelimiters = {}, _wordDelimiters[t.space] = true, _wordDelimiters[t.tab] = true, _wordDelimiters[t.newline] = true, _wordDelimiters[t.cr] = true, _wordDelimiters[t.feed] = true, _wordDelimiters[t.ampersand] = true, _wordDelimiters[t.asterisk] = true, _wordDelimiters[t.bang] = true, _wordDelimiters[t.comma] = true, _wordDelimiters[t.colon] = true, _wordDelimiters[t.semicolon] = true, _wordDelimiters[t.openParenthesis] = true, _wordDelimiters[t.closeParenthesis] = true, _wordDelimiters[t.openSquare] = true, _wordDelimiters[t.closeSquare] = true, _wordDelimiters[t.singleQuote] = true, _wordDelimiters[t.doubleQuote] = true, _wordDelimiters[t.plus] = true, _wordDelimiters[t.pipe] = true, _wordDelimiters[t.tilde] = true, _wordDelimiters[t.greaterThan] = true, _wordDelimiters[t.equals] = true, _wordDelimiters[t.dollar] = true, _wordDelimiters[t.caret] = true, _wordDelimiters[t.slash] = true, _wordDelimiters);
    var hex = {};
    var hexChars = "0123456789abcdefABCDEF";
    for (var i = 0; i < hexChars.length; i++) {
      hex[hexChars.charCodeAt(i)] = true;
    }
    function consumeWord(css, start) {
      var next = start;
      var code;
      do {
        code = css.charCodeAt(next);
        if (wordDelimiters[code]) {
          return next - 1;
        } else if (code === t.backslash) {
          next = consumeEscape(css, next) + 1;
        } else {
          next++;
        }
      } while (next < css.length);
      return next - 1;
    }
    function consumeEscape(css, start) {
      var next = start;
      var code = css.charCodeAt(next + 1);
      if (unescapable[code]) ;
      else if (hex[code]) {
        var hexDigits = 0;
        do {
          next++;
          hexDigits++;
          code = css.charCodeAt(next + 1);
        } while (hex[code] && hexDigits < 6);
        if (hexDigits < 6 && code === t.space) {
          next++;
        }
      } else {
        next++;
      }
      return next;
    }
    var FIELDS = {
      TYPE: 0,
      START_LINE: 1,
      START_COL: 2,
      END_LINE: 3,
      END_COL: 4,
      START_POS: 5,
      END_POS: 6
    };
    exports.FIELDS = FIELDS;
    function tokenize2(input2) {
      var tokens = [];
      var css = input2.css.valueOf();
      var _css = css, length = _css.length;
      var offset = -1;
      var line = 1;
      var start = 0;
      var end = 0;
      var code, content, endColumn, endLine, escaped, escapePos, last, lines, next, nextLine, nextOffset, quote, tokenType;
      function unclosed(what, fix) {
        if (input2.safe) {
          css += fix;
          next = css.length - 1;
        } else {
          throw input2.error("Unclosed " + what, line, start - offset, start);
        }
      }
      while (start < length) {
        code = css.charCodeAt(start);
        if (code === t.newline) {
          offset = start;
          line += 1;
        }
        switch (code) {
          case t.space:
          case t.tab:
          case t.newline:
          case t.cr:
          case t.feed:
            next = start;
            do {
              next += 1;
              code = css.charCodeAt(next);
              if (code === t.newline) {
                offset = next;
                line += 1;
              }
            } while (code === t.space || code === t.newline || code === t.tab || code === t.cr || code === t.feed);
            tokenType = t.space;
            endLine = line;
            endColumn = next - offset - 1;
            end = next;
            break;
          case t.plus:
          case t.greaterThan:
          case t.tilde:
          case t.pipe:
            next = start;
            do {
              next += 1;
              code = css.charCodeAt(next);
            } while (code === t.plus || code === t.greaterThan || code === t.tilde || code === t.pipe);
            tokenType = t.combinator;
            endLine = line;
            endColumn = start - offset;
            end = next;
            break;
          // Consume these characters as single tokens.
          case t.asterisk:
          case t.ampersand:
          case t.bang:
          case t.comma:
          case t.equals:
          case t.dollar:
          case t.caret:
          case t.openSquare:
          case t.closeSquare:
          case t.colon:
          case t.semicolon:
          case t.openParenthesis:
          case t.closeParenthesis:
            next = start;
            tokenType = code;
            endLine = line;
            endColumn = start - offset;
            end = next + 1;
            break;
          case t.singleQuote:
          case t.doubleQuote:
            quote = code === t.singleQuote ? "'" : '"';
            next = start;
            do {
              escaped = false;
              next = css.indexOf(quote, next + 1);
              if (next === -1) {
                unclosed("quote", quote);
              }
              escapePos = next;
              while (css.charCodeAt(escapePos - 1) === t.backslash) {
                escapePos -= 1;
                escaped = !escaped;
              }
            } while (escaped);
            tokenType = t.str;
            endLine = line;
            endColumn = start - offset;
            end = next + 1;
            break;
          default:
            if (code === t.slash && css.charCodeAt(start + 1) === t.asterisk) {
              next = css.indexOf("*/", start + 2) + 1;
              if (next === 0) {
                unclosed("comment", "*/");
              }
              content = css.slice(start, next + 1);
              lines = content.split("\n");
              last = lines.length - 1;
              if (last > 0) {
                nextLine = line + last;
                nextOffset = next - lines[last].length;
              } else {
                nextLine = line;
                nextOffset = offset;
              }
              tokenType = t.comment;
              line = nextLine;
              endLine = nextLine;
              endColumn = next - nextOffset;
            } else if (code === t.slash) {
              next = start;
              tokenType = code;
              endLine = line;
              endColumn = start - offset;
              end = next + 1;
            } else {
              next = consumeWord(css, start);
              tokenType = t.word;
              endLine = line;
              endColumn = next - offset;
            }
            end = next + 1;
            break;
        }
        tokens.push([
          tokenType,
          // [0] Token type
          line,
          // [1] Starting line
          start - offset,
          // [2] Starting column
          endLine,
          // [3] Ending line
          endColumn,
          // [4] Ending column
          start,
          // [5] Start position / Source index
          end
          // [6] End position
        ]);
        if (nextOffset) {
          offset = nextOffset;
          nextOffset = null;
        }
        start = end;
      }
      return tokens;
    }
  })(tokenize);
  return tokenize;
}
var hasRequiredParser$1;
function requireParser$1() {
  if (hasRequiredParser$1) return parser$1.exports;
  hasRequiredParser$1 = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _root = _interopRequireDefault(requireRoot());
    var _selector = _interopRequireDefault(requireSelector());
    var _className = _interopRequireDefault(requireClassName());
    var _comment = _interopRequireDefault(requireComment());
    var _id = _interopRequireDefault(requireId());
    var _tag = _interopRequireDefault(requireTag());
    var _string = _interopRequireDefault(requireString());
    var _pseudo = _interopRequireDefault(requirePseudo());
    var _attribute = _interopRequireWildcard(requireAttribute());
    var _universal = _interopRequireDefault(requireUniversal());
    var _combinator = _interopRequireDefault(requireCombinator());
    var _nesting = _interopRequireDefault(requireNesting());
    var _sortAscending = _interopRequireDefault(requireSortAscending());
    var _tokenize = _interopRequireWildcard(requireTokenize());
    var tokens = _interopRequireWildcard(requireTokenTypes());
    var types2 = _interopRequireWildcard(requireTypes());
    var _util = requireUtil();
    var _WHITESPACE_TOKENS, _Object$assign;
    function _getRequireWildcardCache(nodeInterop) {
      if (typeof WeakMap !== "function") return null;
      var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
      var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
      return (_getRequireWildcardCache = function _getRequireWildcardCache2(nodeInterop2) {
        return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
      })(nodeInterop);
    }
    function _interopRequireWildcard(obj, nodeInterop) {
      if (obj && obj.__esModule) {
        return obj;
      }
      if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return { "default": obj };
      }
      var cache = _getRequireWildcardCache(nodeInterop);
      if (cache && cache.has(obj)) {
        return cache.get(obj);
      }
      var newObj = {};
      var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
      for (var key in obj) {
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
          var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
          if (desc && (desc.get || desc.set)) {
            Object.defineProperty(newObj, key, desc);
          } else {
            newObj[key] = obj[key];
          }
        }
      }
      newObj["default"] = obj;
      if (cache) {
        cache.set(obj, newObj);
      }
      return newObj;
    }
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    function _defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }
    function _createClass(Constructor, protoProps, staticProps) {
      if (protoProps) _defineProperties(Constructor.prototype, protoProps);
      Object.defineProperty(Constructor, "prototype", { writable: false });
      return Constructor;
    }
    var WHITESPACE_TOKENS = (_WHITESPACE_TOKENS = {}, _WHITESPACE_TOKENS[tokens.space] = true, _WHITESPACE_TOKENS[tokens.cr] = true, _WHITESPACE_TOKENS[tokens.feed] = true, _WHITESPACE_TOKENS[tokens.newline] = true, _WHITESPACE_TOKENS[tokens.tab] = true, _WHITESPACE_TOKENS);
    var WHITESPACE_EQUIV_TOKENS = Object.assign({}, WHITESPACE_TOKENS, (_Object$assign = {}, _Object$assign[tokens.comment] = true, _Object$assign));
    function tokenStart(token) {
      return {
        line: token[_tokenize.FIELDS.START_LINE],
        column: token[_tokenize.FIELDS.START_COL]
      };
    }
    function tokenEnd(token) {
      return {
        line: token[_tokenize.FIELDS.END_LINE],
        column: token[_tokenize.FIELDS.END_COL]
      };
    }
    function getSource(startLine, startColumn, endLine, endColumn) {
      return {
        start: {
          line: startLine,
          column: startColumn
        },
        end: {
          line: endLine,
          column: endColumn
        }
      };
    }
    function getTokenSource(token) {
      return getSource(token[_tokenize.FIELDS.START_LINE], token[_tokenize.FIELDS.START_COL], token[_tokenize.FIELDS.END_LINE], token[_tokenize.FIELDS.END_COL]);
    }
    function getTokenSourceSpan(startToken, endToken) {
      if (!startToken) {
        return void 0;
      }
      return getSource(startToken[_tokenize.FIELDS.START_LINE], startToken[_tokenize.FIELDS.START_COL], endToken[_tokenize.FIELDS.END_LINE], endToken[_tokenize.FIELDS.END_COL]);
    }
    function unescapeProp(node2, prop) {
      var value = node2[prop];
      if (typeof value !== "string") {
        return;
      }
      if (value.indexOf("\\") !== -1) {
        (0, _util.ensureObject)(node2, "raws");
        node2[prop] = (0, _util.unesc)(value);
        if (node2.raws[prop] === void 0) {
          node2.raws[prop] = value;
        }
      }
      return node2;
    }
    function indexesOf(array, item) {
      var i = -1;
      var indexes = [];
      while ((i = array.indexOf(item, i + 1)) !== -1) {
        indexes.push(i);
      }
      return indexes;
    }
    function uniqs() {
      var list = Array.prototype.concat.apply([], arguments);
      return list.filter(function(item, i) {
        return i === list.indexOf(item);
      });
    }
    var Parser = /* @__PURE__ */ function() {
      function Parser2(rule2, options) {
        if (options === void 0) {
          options = {};
        }
        this.rule = rule2;
        this.options = Object.assign({
          lossy: false,
          safe: false
        }, options);
        this.position = 0;
        this.css = typeof this.rule === "string" ? this.rule : this.rule.selector;
        this.tokens = (0, _tokenize["default"])({
          css: this.css,
          error: this._errorGenerator(),
          safe: this.options.safe
        });
        var rootSource = getTokenSourceSpan(this.tokens[0], this.tokens[this.tokens.length - 1]);
        this.root = new _root["default"]({
          source: rootSource
        });
        this.root.errorGenerator = this._errorGenerator();
        var selector2 = new _selector["default"]({
          source: {
            start: {
              line: 1,
              column: 1
            }
          },
          sourceIndex: 0
        });
        this.root.append(selector2);
        this.current = selector2;
        this.loop();
      }
      var _proto = Parser2.prototype;
      _proto._errorGenerator = function _errorGenerator() {
        var _this = this;
        return function(message, errorOptions) {
          if (typeof _this.rule === "string") {
            return new Error(message);
          }
          return _this.rule.error(message, errorOptions);
        };
      };
      _proto.attribute = function attribute2() {
        var attr = [];
        var startingToken = this.currToken;
        this.position++;
        while (this.position < this.tokens.length && this.currToken[_tokenize.FIELDS.TYPE] !== tokens.closeSquare) {
          attr.push(this.currToken);
          this.position++;
        }
        if (this.currToken[_tokenize.FIELDS.TYPE] !== tokens.closeSquare) {
          return this.expected("closing square bracket", this.currToken[_tokenize.FIELDS.START_POS]);
        }
        var len = attr.length;
        var node2 = {
          source: getSource(startingToken[1], startingToken[2], this.currToken[3], this.currToken[4]),
          sourceIndex: startingToken[_tokenize.FIELDS.START_POS]
        };
        if (len === 1 && !~[tokens.word].indexOf(attr[0][_tokenize.FIELDS.TYPE])) {
          return this.expected("attribute", attr[0][_tokenize.FIELDS.START_POS]);
        }
        var pos = 0;
        var spaceBefore = "";
        var commentBefore = "";
        var lastAdded = null;
        var spaceAfterMeaningfulToken = false;
        while (pos < len) {
          var token = attr[pos];
          var content = this.content(token);
          var next = attr[pos + 1];
          switch (token[_tokenize.FIELDS.TYPE]) {
            case tokens.space:
              spaceAfterMeaningfulToken = true;
              if (this.options.lossy) {
                break;
              }
              if (lastAdded) {
                (0, _util.ensureObject)(node2, "spaces", lastAdded);
                var prevContent = node2.spaces[lastAdded].after || "";
                node2.spaces[lastAdded].after = prevContent + content;
                var existingComment = (0, _util.getProp)(node2, "raws", "spaces", lastAdded, "after") || null;
                if (existingComment) {
                  node2.raws.spaces[lastAdded].after = existingComment + content;
                }
              } else {
                spaceBefore = spaceBefore + content;
                commentBefore = commentBefore + content;
              }
              break;
            case tokens.asterisk:
              if (next[_tokenize.FIELDS.TYPE] === tokens.equals) {
                node2.operator = content;
                lastAdded = "operator";
              } else if ((!node2.namespace || lastAdded === "namespace" && !spaceAfterMeaningfulToken) && next) {
                if (spaceBefore) {
                  (0, _util.ensureObject)(node2, "spaces", "attribute");
                  node2.spaces.attribute.before = spaceBefore;
                  spaceBefore = "";
                }
                if (commentBefore) {
                  (0, _util.ensureObject)(node2, "raws", "spaces", "attribute");
                  node2.raws.spaces.attribute.before = spaceBefore;
                  commentBefore = "";
                }
                node2.namespace = (node2.namespace || "") + content;
                var rawValue = (0, _util.getProp)(node2, "raws", "namespace") || null;
                if (rawValue) {
                  node2.raws.namespace += content;
                }
                lastAdded = "namespace";
              }
              spaceAfterMeaningfulToken = false;
              break;
            case tokens.dollar:
              if (lastAdded === "value") {
                var oldRawValue = (0, _util.getProp)(node2, "raws", "value");
                node2.value += "$";
                if (oldRawValue) {
                  node2.raws.value = oldRawValue + "$";
                }
                break;
              }
            // Falls through
            case tokens.caret:
              if (next[_tokenize.FIELDS.TYPE] === tokens.equals) {
                node2.operator = content;
                lastAdded = "operator";
              }
              spaceAfterMeaningfulToken = false;
              break;
            case tokens.combinator:
              if (content === "~" && next[_tokenize.FIELDS.TYPE] === tokens.equals) {
                node2.operator = content;
                lastAdded = "operator";
              }
              if (content !== "|") {
                spaceAfterMeaningfulToken = false;
                break;
              }
              if (next[_tokenize.FIELDS.TYPE] === tokens.equals) {
                node2.operator = content;
                lastAdded = "operator";
              } else if (!node2.namespace && !node2.attribute) {
                node2.namespace = true;
              }
              spaceAfterMeaningfulToken = false;
              break;
            case tokens.word:
              if (next && this.content(next) === "|" && attr[pos + 2] && attr[pos + 2][_tokenize.FIELDS.TYPE] !== tokens.equals && // this look-ahead probably fails with comment nodes involved.
              !node2.operator && !node2.namespace) {
                node2.namespace = content;
                lastAdded = "namespace";
              } else if (!node2.attribute || lastAdded === "attribute" && !spaceAfterMeaningfulToken) {
                if (spaceBefore) {
                  (0, _util.ensureObject)(node2, "spaces", "attribute");
                  node2.spaces.attribute.before = spaceBefore;
                  spaceBefore = "";
                }
                if (commentBefore) {
                  (0, _util.ensureObject)(node2, "raws", "spaces", "attribute");
                  node2.raws.spaces.attribute.before = commentBefore;
                  commentBefore = "";
                }
                node2.attribute = (node2.attribute || "") + content;
                var _rawValue = (0, _util.getProp)(node2, "raws", "attribute") || null;
                if (_rawValue) {
                  node2.raws.attribute += content;
                }
                lastAdded = "attribute";
              } else if (!node2.value && node2.value !== "" || lastAdded === "value" && !(spaceAfterMeaningfulToken || node2.quoteMark)) {
                var _unescaped = (0, _util.unesc)(content);
                var _oldRawValue = (0, _util.getProp)(node2, "raws", "value") || "";
                var oldValue = node2.value || "";
                node2.value = oldValue + _unescaped;
                node2.quoteMark = null;
                if (_unescaped !== content || _oldRawValue) {
                  (0, _util.ensureObject)(node2, "raws");
                  node2.raws.value = (_oldRawValue || oldValue) + content;
                }
                lastAdded = "value";
              } else {
                var insensitive = content === "i" || content === "I";
                if ((node2.value || node2.value === "") && (node2.quoteMark || spaceAfterMeaningfulToken)) {
                  node2.insensitive = insensitive;
                  if (!insensitive || content === "I") {
                    (0, _util.ensureObject)(node2, "raws");
                    node2.raws.insensitiveFlag = content;
                  }
                  lastAdded = "insensitive";
                  if (spaceBefore) {
                    (0, _util.ensureObject)(node2, "spaces", "insensitive");
                    node2.spaces.insensitive.before = spaceBefore;
                    spaceBefore = "";
                  }
                  if (commentBefore) {
                    (0, _util.ensureObject)(node2, "raws", "spaces", "insensitive");
                    node2.raws.spaces.insensitive.before = commentBefore;
                    commentBefore = "";
                  }
                } else if (node2.value || node2.value === "") {
                  lastAdded = "value";
                  node2.value += content;
                  if (node2.raws.value) {
                    node2.raws.value += content;
                  }
                }
              }
              spaceAfterMeaningfulToken = false;
              break;
            case tokens.str:
              if (!node2.attribute || !node2.operator) {
                return this.error("Expected an attribute followed by an operator preceding the string.", {
                  index: token[_tokenize.FIELDS.START_POS]
                });
              }
              var _unescapeValue = (0, _attribute.unescapeValue)(content), unescaped = _unescapeValue.unescaped, quoteMark = _unescapeValue.quoteMark;
              node2.value = unescaped;
              node2.quoteMark = quoteMark;
              lastAdded = "value";
              (0, _util.ensureObject)(node2, "raws");
              node2.raws.value = content;
              spaceAfterMeaningfulToken = false;
              break;
            case tokens.equals:
              if (!node2.attribute) {
                return this.expected("attribute", token[_tokenize.FIELDS.START_POS], content);
              }
              if (node2.value) {
                return this.error('Unexpected "=" found; an operator was already defined.', {
                  index: token[_tokenize.FIELDS.START_POS]
                });
              }
              node2.operator = node2.operator ? node2.operator + content : content;
              lastAdded = "operator";
              spaceAfterMeaningfulToken = false;
              break;
            case tokens.comment:
              if (lastAdded) {
                if (spaceAfterMeaningfulToken || next && next[_tokenize.FIELDS.TYPE] === tokens.space || lastAdded === "insensitive") {
                  var lastComment = (0, _util.getProp)(node2, "spaces", lastAdded, "after") || "";
                  var rawLastComment = (0, _util.getProp)(node2, "raws", "spaces", lastAdded, "after") || lastComment;
                  (0, _util.ensureObject)(node2, "raws", "spaces", lastAdded);
                  node2.raws.spaces[lastAdded].after = rawLastComment + content;
                } else {
                  var lastValue = node2[lastAdded] || "";
                  var rawLastValue = (0, _util.getProp)(node2, "raws", lastAdded) || lastValue;
                  (0, _util.ensureObject)(node2, "raws");
                  node2.raws[lastAdded] = rawLastValue + content;
                }
              } else {
                commentBefore = commentBefore + content;
              }
              break;
            default:
              return this.error('Unexpected "' + content + '" found.', {
                index: token[_tokenize.FIELDS.START_POS]
              });
          }
          pos++;
        }
        unescapeProp(node2, "attribute");
        unescapeProp(node2, "namespace");
        this.newNode(new _attribute["default"](node2));
        this.position++;
      };
      _proto.parseWhitespaceEquivalentTokens = function parseWhitespaceEquivalentTokens(stopPosition) {
        if (stopPosition < 0) {
          stopPosition = this.tokens.length;
        }
        var startPosition = this.position;
        var nodes = [];
        var space = "";
        var lastComment = void 0;
        do {
          if (WHITESPACE_TOKENS[this.currToken[_tokenize.FIELDS.TYPE]]) {
            if (!this.options.lossy) {
              space += this.content();
            }
          } else if (this.currToken[_tokenize.FIELDS.TYPE] === tokens.comment) {
            var spaces = {};
            if (space) {
              spaces.before = space;
              space = "";
            }
            lastComment = new _comment["default"]({
              value: this.content(),
              source: getTokenSource(this.currToken),
              sourceIndex: this.currToken[_tokenize.FIELDS.START_POS],
              spaces
            });
            nodes.push(lastComment);
          }
        } while (++this.position < stopPosition);
        if (space) {
          if (lastComment) {
            lastComment.spaces.after = space;
          } else if (!this.options.lossy) {
            var firstToken = this.tokens[startPosition];
            var lastToken = this.tokens[this.position - 1];
            nodes.push(new _string["default"]({
              value: "",
              source: getSource(firstToken[_tokenize.FIELDS.START_LINE], firstToken[_tokenize.FIELDS.START_COL], lastToken[_tokenize.FIELDS.END_LINE], lastToken[_tokenize.FIELDS.END_COL]),
              sourceIndex: firstToken[_tokenize.FIELDS.START_POS],
              spaces: {
                before: space,
                after: ""
              }
            }));
          }
        }
        return nodes;
      };
      _proto.convertWhitespaceNodesToSpace = function convertWhitespaceNodesToSpace(nodes, requiredSpace) {
        var _this2 = this;
        if (requiredSpace === void 0) {
          requiredSpace = false;
        }
        var space = "";
        var rawSpace = "";
        nodes.forEach(function(n) {
          var spaceBefore = _this2.lossySpace(n.spaces.before, requiredSpace);
          var rawSpaceBefore = _this2.lossySpace(n.rawSpaceBefore, requiredSpace);
          space += spaceBefore + _this2.lossySpace(n.spaces.after, requiredSpace && spaceBefore.length === 0);
          rawSpace += spaceBefore + n.value + _this2.lossySpace(n.rawSpaceAfter, requiredSpace && rawSpaceBefore.length === 0);
        });
        if (rawSpace === space) {
          rawSpace = void 0;
        }
        var result2 = {
          space,
          rawSpace
        };
        return result2;
      };
      _proto.isNamedCombinator = function isNamedCombinator(position) {
        if (position === void 0) {
          position = this.position;
        }
        return this.tokens[position + 0] && this.tokens[position + 0][_tokenize.FIELDS.TYPE] === tokens.slash && this.tokens[position + 1] && this.tokens[position + 1][_tokenize.FIELDS.TYPE] === tokens.word && this.tokens[position + 2] && this.tokens[position + 2][_tokenize.FIELDS.TYPE] === tokens.slash;
      };
      _proto.namedCombinator = function namedCombinator() {
        if (this.isNamedCombinator()) {
          var nameRaw = this.content(this.tokens[this.position + 1]);
          var name = (0, _util.unesc)(nameRaw).toLowerCase();
          var raws = {};
          if (name !== nameRaw) {
            raws.value = "/" + nameRaw + "/";
          }
          var node2 = new _combinator["default"]({
            value: "/" + name + "/",
            source: getSource(this.currToken[_tokenize.FIELDS.START_LINE], this.currToken[_tokenize.FIELDS.START_COL], this.tokens[this.position + 2][_tokenize.FIELDS.END_LINE], this.tokens[this.position + 2][_tokenize.FIELDS.END_COL]),
            sourceIndex: this.currToken[_tokenize.FIELDS.START_POS],
            raws
          });
          this.position = this.position + 3;
          return node2;
        } else {
          this.unexpected();
        }
      };
      _proto.combinator = function combinator2() {
        var _this3 = this;
        if (this.content() === "|") {
          return this.namespace();
        }
        var nextSigTokenPos = this.locateNextMeaningfulToken(this.position);
        if (nextSigTokenPos < 0 || this.tokens[nextSigTokenPos][_tokenize.FIELDS.TYPE] === tokens.comma || this.tokens[nextSigTokenPos][_tokenize.FIELDS.TYPE] === tokens.closeParenthesis) {
          var nodes = this.parseWhitespaceEquivalentTokens(nextSigTokenPos);
          if (nodes.length > 0) {
            var last = this.current.last;
            if (last) {
              var _this$convertWhitespa = this.convertWhitespaceNodesToSpace(nodes), space = _this$convertWhitespa.space, rawSpace = _this$convertWhitespa.rawSpace;
              if (rawSpace !== void 0) {
                last.rawSpaceAfter += rawSpace;
              }
              last.spaces.after += space;
            } else {
              nodes.forEach(function(n) {
                return _this3.newNode(n);
              });
            }
          }
          return;
        }
        var firstToken = this.currToken;
        var spaceOrDescendantSelectorNodes = void 0;
        if (nextSigTokenPos > this.position) {
          spaceOrDescendantSelectorNodes = this.parseWhitespaceEquivalentTokens(nextSigTokenPos);
        }
        var node2;
        if (this.isNamedCombinator()) {
          node2 = this.namedCombinator();
        } else if (this.currToken[_tokenize.FIELDS.TYPE] === tokens.combinator) {
          node2 = new _combinator["default"]({
            value: this.content(),
            source: getTokenSource(this.currToken),
            sourceIndex: this.currToken[_tokenize.FIELDS.START_POS]
          });
          this.position++;
        } else if (WHITESPACE_TOKENS[this.currToken[_tokenize.FIELDS.TYPE]]) ;
        else if (!spaceOrDescendantSelectorNodes) {
          this.unexpected();
        }
        if (node2) {
          if (spaceOrDescendantSelectorNodes) {
            var _this$convertWhitespa2 = this.convertWhitespaceNodesToSpace(spaceOrDescendantSelectorNodes), _space = _this$convertWhitespa2.space, _rawSpace = _this$convertWhitespa2.rawSpace;
            node2.spaces.before = _space;
            node2.rawSpaceBefore = _rawSpace;
          }
        } else {
          var _this$convertWhitespa3 = this.convertWhitespaceNodesToSpace(spaceOrDescendantSelectorNodes, true), _space2 = _this$convertWhitespa3.space, _rawSpace2 = _this$convertWhitespa3.rawSpace;
          if (!_rawSpace2) {
            _rawSpace2 = _space2;
          }
          var spaces = {};
          var raws = {
            spaces: {}
          };
          if (_space2.endsWith(" ") && _rawSpace2.endsWith(" ")) {
            spaces.before = _space2.slice(0, _space2.length - 1);
            raws.spaces.before = _rawSpace2.slice(0, _rawSpace2.length - 1);
          } else if (_space2.startsWith(" ") && _rawSpace2.startsWith(" ")) {
            spaces.after = _space2.slice(1);
            raws.spaces.after = _rawSpace2.slice(1);
          } else {
            raws.value = _rawSpace2;
          }
          node2 = new _combinator["default"]({
            value: " ",
            source: getTokenSourceSpan(firstToken, this.tokens[this.position - 1]),
            sourceIndex: firstToken[_tokenize.FIELDS.START_POS],
            spaces,
            raws
          });
        }
        if (this.currToken && this.currToken[_tokenize.FIELDS.TYPE] === tokens.space) {
          node2.spaces.after = this.optionalSpace(this.content());
          this.position++;
        }
        return this.newNode(node2);
      };
      _proto.comma = function comma() {
        if (this.position === this.tokens.length - 1) {
          this.root.trailingComma = true;
          this.position++;
          return;
        }
        this.current._inferEndPosition();
        var selector2 = new _selector["default"]({
          source: {
            start: tokenStart(this.tokens[this.position + 1])
          },
          sourceIndex: this.tokens[this.position + 1][_tokenize.FIELDS.START_POS]
        });
        this.current.parent.append(selector2);
        this.current = selector2;
        this.position++;
      };
      _proto.comment = function comment2() {
        var current = this.currToken;
        this.newNode(new _comment["default"]({
          value: this.content(),
          source: getTokenSource(current),
          sourceIndex: current[_tokenize.FIELDS.START_POS]
        }));
        this.position++;
      };
      _proto.error = function error(message, opts) {
        throw this.root.error(message, opts);
      };
      _proto.missingBackslash = function missingBackslash() {
        return this.error("Expected a backslash preceding the semicolon.", {
          index: this.currToken[_tokenize.FIELDS.START_POS]
        });
      };
      _proto.missingParenthesis = function missingParenthesis() {
        return this.expected("opening parenthesis", this.currToken[_tokenize.FIELDS.START_POS]);
      };
      _proto.missingSquareBracket = function missingSquareBracket() {
        return this.expected("opening square bracket", this.currToken[_tokenize.FIELDS.START_POS]);
      };
      _proto.unexpected = function unexpected() {
        return this.error("Unexpected '" + this.content() + "'. Escaping special characters with \\ may help.", this.currToken[_tokenize.FIELDS.START_POS]);
      };
      _proto.unexpectedPipe = function unexpectedPipe() {
        return this.error("Unexpected '|'.", this.currToken[_tokenize.FIELDS.START_POS]);
      };
      _proto.namespace = function namespace2() {
        var before = this.prevToken && this.content(this.prevToken) || true;
        if (this.nextToken[_tokenize.FIELDS.TYPE] === tokens.word) {
          this.position++;
          return this.word(before);
        } else if (this.nextToken[_tokenize.FIELDS.TYPE] === tokens.asterisk) {
          this.position++;
          return this.universal(before);
        }
        this.unexpectedPipe();
      };
      _proto.nesting = function nesting2() {
        if (this.nextToken) {
          var nextContent = this.content(this.nextToken);
          if (nextContent === "|") {
            this.position++;
            return;
          }
        }
        var current = this.currToken;
        this.newNode(new _nesting["default"]({
          value: this.content(),
          source: getTokenSource(current),
          sourceIndex: current[_tokenize.FIELDS.START_POS]
        }));
        this.position++;
      };
      _proto.parentheses = function parentheses() {
        var last = this.current.last;
        var unbalanced = 1;
        this.position++;
        if (last && last.type === types2.PSEUDO) {
          var selector2 = new _selector["default"]({
            source: {
              start: tokenStart(this.tokens[this.position])
            },
            sourceIndex: this.tokens[this.position][_tokenize.FIELDS.START_POS]
          });
          var cache = this.current;
          last.append(selector2);
          this.current = selector2;
          while (this.position < this.tokens.length && unbalanced) {
            if (this.currToken[_tokenize.FIELDS.TYPE] === tokens.openParenthesis) {
              unbalanced++;
            }
            if (this.currToken[_tokenize.FIELDS.TYPE] === tokens.closeParenthesis) {
              unbalanced--;
            }
            if (unbalanced) {
              this.parse();
            } else {
              this.current.source.end = tokenEnd(this.currToken);
              this.current.parent.source.end = tokenEnd(this.currToken);
              this.position++;
            }
          }
          this.current = cache;
        } else {
          var parenStart = this.currToken;
          var parenValue = "(";
          var parenEnd;
          while (this.position < this.tokens.length && unbalanced) {
            if (this.currToken[_tokenize.FIELDS.TYPE] === tokens.openParenthesis) {
              unbalanced++;
            }
            if (this.currToken[_tokenize.FIELDS.TYPE] === tokens.closeParenthesis) {
              unbalanced--;
            }
            parenEnd = this.currToken;
            parenValue += this.parseParenthesisToken(this.currToken);
            this.position++;
          }
          if (last) {
            last.appendToPropertyAndEscape("value", parenValue, parenValue);
          } else {
            this.newNode(new _string["default"]({
              value: parenValue,
              source: getSource(parenStart[_tokenize.FIELDS.START_LINE], parenStart[_tokenize.FIELDS.START_COL], parenEnd[_tokenize.FIELDS.END_LINE], parenEnd[_tokenize.FIELDS.END_COL]),
              sourceIndex: parenStart[_tokenize.FIELDS.START_POS]
            }));
          }
        }
        if (unbalanced) {
          return this.expected("closing parenthesis", this.currToken[_tokenize.FIELDS.START_POS]);
        }
      };
      _proto.pseudo = function pseudo2() {
        var _this4 = this;
        var pseudoStr = "";
        var startingToken = this.currToken;
        while (this.currToken && this.currToken[_tokenize.FIELDS.TYPE] === tokens.colon) {
          pseudoStr += this.content();
          this.position++;
        }
        if (!this.currToken) {
          return this.expected(["pseudo-class", "pseudo-element"], this.position - 1);
        }
        if (this.currToken[_tokenize.FIELDS.TYPE] === tokens.word) {
          this.splitWord(false, function(first, length) {
            pseudoStr += first;
            _this4.newNode(new _pseudo["default"]({
              value: pseudoStr,
              source: getTokenSourceSpan(startingToken, _this4.currToken),
              sourceIndex: startingToken[_tokenize.FIELDS.START_POS]
            }));
            if (length > 1 && _this4.nextToken && _this4.nextToken[_tokenize.FIELDS.TYPE] === tokens.openParenthesis) {
              _this4.error("Misplaced parenthesis.", {
                index: _this4.nextToken[_tokenize.FIELDS.START_POS]
              });
            }
          });
        } else {
          return this.expected(["pseudo-class", "pseudo-element"], this.currToken[_tokenize.FIELDS.START_POS]);
        }
      };
      _proto.space = function space() {
        var content = this.content();
        if (this.position === 0 || this.prevToken[_tokenize.FIELDS.TYPE] === tokens.comma || this.prevToken[_tokenize.FIELDS.TYPE] === tokens.openParenthesis || this.current.nodes.every(function(node2) {
          return node2.type === "comment";
        })) {
          this.spaces = this.optionalSpace(content);
          this.position++;
        } else if (this.position === this.tokens.length - 1 || this.nextToken[_tokenize.FIELDS.TYPE] === tokens.comma || this.nextToken[_tokenize.FIELDS.TYPE] === tokens.closeParenthesis) {
          this.current.last.spaces.after = this.optionalSpace(content);
          this.position++;
        } else {
          this.combinator();
        }
      };
      _proto.string = function string2() {
        var current = this.currToken;
        this.newNode(new _string["default"]({
          value: this.content(),
          source: getTokenSource(current),
          sourceIndex: current[_tokenize.FIELDS.START_POS]
        }));
        this.position++;
      };
      _proto.universal = function universal2(namespace2) {
        var nextToken = this.nextToken;
        if (nextToken && this.content(nextToken) === "|") {
          this.position++;
          return this.namespace();
        }
        var current = this.currToken;
        this.newNode(new _universal["default"]({
          value: this.content(),
          source: getTokenSource(current),
          sourceIndex: current[_tokenize.FIELDS.START_POS]
        }), namespace2);
        this.position++;
      };
      _proto.splitWord = function splitWord(namespace2, firstCallback) {
        var _this5 = this;
        var nextToken = this.nextToken;
        var word = this.content();
        while (nextToken && ~[tokens.dollar, tokens.caret, tokens.equals, tokens.word].indexOf(nextToken[_tokenize.FIELDS.TYPE])) {
          this.position++;
          var current = this.content();
          word += current;
          if (current.lastIndexOf("\\") === current.length - 1) {
            var next = this.nextToken;
            if (next && next[_tokenize.FIELDS.TYPE] === tokens.space) {
              word += this.requiredSpace(this.content(next));
              this.position++;
            }
          }
          nextToken = this.nextToken;
        }
        var hasClass = indexesOf(word, ".").filter(function(i) {
          var escapedDot = word[i - 1] === "\\";
          var isKeyframesPercent = /^\d+\.\d+%$/.test(word);
          return !escapedDot && !isKeyframesPercent;
        });
        var hasId = indexesOf(word, "#").filter(function(i) {
          return word[i - 1] !== "\\";
        });
        var interpolations = indexesOf(word, "#{");
        if (interpolations.length) {
          hasId = hasId.filter(function(hashIndex) {
            return !~interpolations.indexOf(hashIndex);
          });
        }
        var indices = (0, _sortAscending["default"])(uniqs([0].concat(hasClass, hasId)));
        indices.forEach(function(ind, i) {
          var index = indices[i + 1] || word.length;
          var value = word.slice(ind, index);
          if (i === 0 && firstCallback) {
            return firstCallback.call(_this5, value, indices.length);
          }
          var node2;
          var current2 = _this5.currToken;
          var sourceIndex = current2[_tokenize.FIELDS.START_POS] + indices[i];
          var source = getSource(current2[1], current2[2] + ind, current2[3], current2[2] + (index - 1));
          if (~hasClass.indexOf(ind)) {
            var classNameOpts = {
              value: value.slice(1),
              source,
              sourceIndex
            };
            node2 = new _className["default"](unescapeProp(classNameOpts, "value"));
          } else if (~hasId.indexOf(ind)) {
            var idOpts = {
              value: value.slice(1),
              source,
              sourceIndex
            };
            node2 = new _id["default"](unescapeProp(idOpts, "value"));
          } else {
            var tagOpts = {
              value,
              source,
              sourceIndex
            };
            unescapeProp(tagOpts, "value");
            node2 = new _tag["default"](tagOpts);
          }
          _this5.newNode(node2, namespace2);
          namespace2 = null;
        });
        this.position++;
      };
      _proto.word = function word(namespace2) {
        var nextToken = this.nextToken;
        if (nextToken && this.content(nextToken) === "|") {
          this.position++;
          return this.namespace();
        }
        return this.splitWord(namespace2);
      };
      _proto.loop = function loop() {
        while (this.position < this.tokens.length) {
          this.parse(true);
        }
        this.current._inferEndPosition();
        return this.root;
      };
      _proto.parse = function parse2(throwOnParenthesis) {
        switch (this.currToken[_tokenize.FIELDS.TYPE]) {
          case tokens.space:
            this.space();
            break;
          case tokens.comment:
            this.comment();
            break;
          case tokens.openParenthesis:
            this.parentheses();
            break;
          case tokens.closeParenthesis:
            if (throwOnParenthesis) {
              this.missingParenthesis();
            }
            break;
          case tokens.openSquare:
            this.attribute();
            break;
          case tokens.dollar:
          case tokens.caret:
          case tokens.equals:
          case tokens.word:
            this.word();
            break;
          case tokens.colon:
            this.pseudo();
            break;
          case tokens.comma:
            this.comma();
            break;
          case tokens.asterisk:
            this.universal();
            break;
          case tokens.ampersand:
            this.nesting();
            break;
          case tokens.slash:
          case tokens.combinator:
            this.combinator();
            break;
          case tokens.str:
            this.string();
            break;
          // These cases throw; no break needed.
          case tokens.closeSquare:
            this.missingSquareBracket();
          case tokens.semicolon:
            this.missingBackslash();
          default:
            this.unexpected();
        }
      };
      _proto.expected = function expected(description, index, found) {
        if (Array.isArray(description)) {
          var last = description.pop();
          description = description.join(", ") + " or " + last;
        }
        var an = /^[aeiou]/.test(description[0]) ? "an" : "a";
        if (!found) {
          return this.error("Expected " + an + " " + description + ".", {
            index
          });
        }
        return this.error("Expected " + an + " " + description + ', found "' + found + '" instead.', {
          index
        });
      };
      _proto.requiredSpace = function requiredSpace(space) {
        return this.options.lossy ? " " : space;
      };
      _proto.optionalSpace = function optionalSpace(space) {
        return this.options.lossy ? "" : space;
      };
      _proto.lossySpace = function lossySpace(space, required) {
        if (this.options.lossy) {
          return required ? " " : "";
        } else {
          return space;
        }
      };
      _proto.parseParenthesisToken = function parseParenthesisToken(token) {
        var content = this.content(token);
        if (token[_tokenize.FIELDS.TYPE] === tokens.space) {
          return this.requiredSpace(content);
        } else {
          return content;
        }
      };
      _proto.newNode = function newNode(node2, namespace2) {
        if (namespace2) {
          if (/^ +$/.test(namespace2)) {
            if (!this.options.lossy) {
              this.spaces = (this.spaces || "") + namespace2;
            }
            namespace2 = true;
          }
          node2.namespace = namespace2;
          unescapeProp(node2, "namespace");
        }
        if (this.spaces) {
          node2.spaces.before = this.spaces;
          this.spaces = "";
        }
        return this.current.append(node2);
      };
      _proto.content = function content(token) {
        if (token === void 0) {
          token = this.currToken;
        }
        return this.css.slice(token[_tokenize.FIELDS.START_POS], token[_tokenize.FIELDS.END_POS]);
      };
      _proto.locateNextMeaningfulToken = function locateNextMeaningfulToken(startPosition) {
        if (startPosition === void 0) {
          startPosition = this.position + 1;
        }
        var searchPosition = startPosition;
        while (searchPosition < this.tokens.length) {
          if (WHITESPACE_EQUIV_TOKENS[this.tokens[searchPosition][_tokenize.FIELDS.TYPE]]) {
            searchPosition++;
            continue;
          } else {
            return searchPosition;
          }
        }
        return -1;
      };
      _createClass(Parser2, [{
        key: "currToken",
        get: function get() {
          return this.tokens[this.position];
        }
      }, {
        key: "nextToken",
        get: function get() {
          return this.tokens[this.position + 1];
        }
      }, {
        key: "prevToken",
        get: function get() {
          return this.tokens[this.position - 1];
        }
      }]);
      return Parser2;
    }();
    exports["default"] = Parser;
    module.exports = exports.default;
  })(parser$1, parser$1.exports);
  return parser$1.exports;
}
var hasRequiredProcessor;
function requireProcessor() {
  if (hasRequiredProcessor) return processor.exports;
  hasRequiredProcessor = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _parser = _interopRequireDefault(requireParser$1());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    var Processor = /* @__PURE__ */ function() {
      function Processor2(func, options) {
        this.func = func || function noop() {
        };
        this.funcRes = null;
        this.options = options;
      }
      var _proto = Processor2.prototype;
      _proto._shouldUpdateSelector = function _shouldUpdateSelector(rule2, options) {
        if (options === void 0) {
          options = {};
        }
        var merged = Object.assign({}, this.options, options);
        if (merged.updateSelector === false) {
          return false;
        } else {
          return typeof rule2 !== "string";
        }
      };
      _proto._isLossy = function _isLossy(options) {
        if (options === void 0) {
          options = {};
        }
        var merged = Object.assign({}, this.options, options);
        if (merged.lossless === false) {
          return true;
        } else {
          return false;
        }
      };
      _proto._root = function _root(rule2, options) {
        if (options === void 0) {
          options = {};
        }
        var parser2 = new _parser["default"](rule2, this._parseOptions(options));
        return parser2.root;
      };
      _proto._parseOptions = function _parseOptions(options) {
        return {
          lossy: this._isLossy(options)
        };
      };
      _proto._run = function _run(rule2, options) {
        var _this = this;
        if (options === void 0) {
          options = {};
        }
        return new Promise(function(resolve, reject) {
          try {
            var root2 = _this._root(rule2, options);
            Promise.resolve(_this.func(root2)).then(function(transform2) {
              var string2 = void 0;
              if (_this._shouldUpdateSelector(rule2, options)) {
                string2 = root2.toString();
                rule2.selector = string2;
              }
              return {
                transform: transform2,
                root: root2,
                string: string2
              };
            }).then(resolve, reject);
          } catch (e2) {
            reject(e2);
            return;
          }
        });
      };
      _proto._runSync = function _runSync(rule2, options) {
        if (options === void 0) {
          options = {};
        }
        var root2 = this._root(rule2, options);
        var transform2 = this.func(root2);
        if (transform2 && typeof transform2.then === "function") {
          throw new Error("Selector processor returned a promise to a synchronous call.");
        }
        var string2 = void 0;
        if (options.updateSelector && typeof rule2 !== "string") {
          string2 = root2.toString();
          rule2.selector = string2;
        }
        return {
          transform: transform2,
          root: root2,
          string: string2
        };
      };
      _proto.ast = function ast(rule2, options) {
        return this._run(rule2, options).then(function(result2) {
          return result2.root;
        });
      };
      _proto.astSync = function astSync(rule2, options) {
        return this._runSync(rule2, options).root;
      };
      _proto.transform = function transform2(rule2, options) {
        return this._run(rule2, options).then(function(result2) {
          return result2.transform;
        });
      };
      _proto.transformSync = function transformSync(rule2, options) {
        return this._runSync(rule2, options).transform;
      };
      _proto.process = function process2(rule2, options) {
        return this._run(rule2, options).then(function(result2) {
          return result2.string || result2.root.toString();
        });
      };
      _proto.processSync = function processSync(rule2, options) {
        var result2 = this._runSync(rule2, options);
        return result2.string || result2.root.toString();
      };
      return Processor2;
    }();
    exports["default"] = Processor;
    module.exports = exports.default;
  })(processor, processor.exports);
  return processor.exports;
}
var selectors = {};
var constructors = {};
var hasRequiredConstructors;
function requireConstructors() {
  if (hasRequiredConstructors) return constructors;
  hasRequiredConstructors = 1;
  constructors.__esModule = true;
  constructors.universal = constructors.tag = constructors.string = constructors.selector = constructors.root = constructors.pseudo = constructors.nesting = constructors.id = constructors.comment = constructors.combinator = constructors.className = constructors.attribute = void 0;
  var _attribute = _interopRequireDefault(requireAttribute());
  var _className = _interopRequireDefault(requireClassName());
  var _combinator = _interopRequireDefault(requireCombinator());
  var _comment = _interopRequireDefault(requireComment());
  var _id = _interopRequireDefault(requireId());
  var _nesting = _interopRequireDefault(requireNesting());
  var _pseudo = _interopRequireDefault(requirePseudo());
  var _root = _interopRequireDefault(requireRoot());
  var _selector = _interopRequireDefault(requireSelector());
  var _string = _interopRequireDefault(requireString());
  var _tag = _interopRequireDefault(requireTag());
  var _universal = _interopRequireDefault(requireUniversal());
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { "default": obj };
  }
  var attribute2 = function attribute3(opts) {
    return new _attribute["default"](opts);
  };
  constructors.attribute = attribute2;
  var className2 = function className3(opts) {
    return new _className["default"](opts);
  };
  constructors.className = className2;
  var combinator2 = function combinator3(opts) {
    return new _combinator["default"](opts);
  };
  constructors.combinator = combinator2;
  var comment2 = function comment3(opts) {
    return new _comment["default"](opts);
  };
  constructors.comment = comment2;
  var id2 = function id3(opts) {
    return new _id["default"](opts);
  };
  constructors.id = id2;
  var nesting2 = function nesting3(opts) {
    return new _nesting["default"](opts);
  };
  constructors.nesting = nesting2;
  var pseudo2 = function pseudo3(opts) {
    return new _pseudo["default"](opts);
  };
  constructors.pseudo = pseudo2;
  var root2 = function root3(opts) {
    return new _root["default"](opts);
  };
  constructors.root = root2;
  var selector2 = function selector3(opts) {
    return new _selector["default"](opts);
  };
  constructors.selector = selector2;
  var string2 = function string3(opts) {
    return new _string["default"](opts);
  };
  constructors.string = string2;
  var tag2 = function tag3(opts) {
    return new _tag["default"](opts);
  };
  constructors.tag = tag2;
  var universal2 = function universal3(opts) {
    return new _universal["default"](opts);
  };
  constructors.universal = universal2;
  return constructors;
}
var guards = {};
var hasRequiredGuards;
function requireGuards() {
  if (hasRequiredGuards) return guards;
  hasRequiredGuards = 1;
  guards.__esModule = true;
  guards.isComment = guards.isCombinator = guards.isClassName = guards.isAttribute = void 0;
  guards.isContainer = isContainer;
  guards.isIdentifier = void 0;
  guards.isNamespace = isNamespace;
  guards.isNesting = void 0;
  guards.isNode = isNode;
  guards.isPseudo = void 0;
  guards.isPseudoClass = isPseudoClass;
  guards.isPseudoElement = isPseudoElement;
  guards.isUniversal = guards.isTag = guards.isString = guards.isSelector = guards.isRoot = void 0;
  var _types = requireTypes();
  var _IS_TYPE;
  var IS_TYPE = (_IS_TYPE = {}, _IS_TYPE[_types.ATTRIBUTE] = true, _IS_TYPE[_types.CLASS] = true, _IS_TYPE[_types.COMBINATOR] = true, _IS_TYPE[_types.COMMENT] = true, _IS_TYPE[_types.ID] = true, _IS_TYPE[_types.NESTING] = true, _IS_TYPE[_types.PSEUDO] = true, _IS_TYPE[_types.ROOT] = true, _IS_TYPE[_types.SELECTOR] = true, _IS_TYPE[_types.STRING] = true, _IS_TYPE[_types.TAG] = true, _IS_TYPE[_types.UNIVERSAL] = true, _IS_TYPE);
  function isNode(node2) {
    return typeof node2 === "object" && IS_TYPE[node2.type];
  }
  function isNodeType(type, node2) {
    return isNode(node2) && node2.type === type;
  }
  var isAttribute = isNodeType.bind(null, _types.ATTRIBUTE);
  guards.isAttribute = isAttribute;
  var isClassName = isNodeType.bind(null, _types.CLASS);
  guards.isClassName = isClassName;
  var isCombinator = isNodeType.bind(null, _types.COMBINATOR);
  guards.isCombinator = isCombinator;
  var isComment = isNodeType.bind(null, _types.COMMENT);
  guards.isComment = isComment;
  var isIdentifier = isNodeType.bind(null, _types.ID);
  guards.isIdentifier = isIdentifier;
  var isNesting = isNodeType.bind(null, _types.NESTING);
  guards.isNesting = isNesting;
  var isPseudo = isNodeType.bind(null, _types.PSEUDO);
  guards.isPseudo = isPseudo;
  var isRoot = isNodeType.bind(null, _types.ROOT);
  guards.isRoot = isRoot;
  var isSelector = isNodeType.bind(null, _types.SELECTOR);
  guards.isSelector = isSelector;
  var isString = isNodeType.bind(null, _types.STRING);
  guards.isString = isString;
  var isTag = isNodeType.bind(null, _types.TAG);
  guards.isTag = isTag;
  var isUniversal = isNodeType.bind(null, _types.UNIVERSAL);
  guards.isUniversal = isUniversal;
  function isPseudoElement(node2) {
    return isPseudo(node2) && node2.value && (node2.value.startsWith("::") || node2.value.toLowerCase() === ":before" || node2.value.toLowerCase() === ":after" || node2.value.toLowerCase() === ":first-letter" || node2.value.toLowerCase() === ":first-line");
  }
  function isPseudoClass(node2) {
    return isPseudo(node2) && !isPseudoElement(node2);
  }
  function isContainer(node2) {
    return !!(isNode(node2) && node2.walk);
  }
  function isNamespace(node2) {
    return isAttribute(node2) || isTag(node2);
  }
  return guards;
}
var hasRequiredSelectors;
function requireSelectors() {
  if (hasRequiredSelectors) return selectors;
  hasRequiredSelectors = 1;
  (function(exports) {
    exports.__esModule = true;
    var _types = requireTypes();
    Object.keys(_types).forEach(function(key) {
      if (key === "default" || key === "__esModule") return;
      if (key in exports && exports[key] === _types[key]) return;
      exports[key] = _types[key];
    });
    var _constructors = requireConstructors();
    Object.keys(_constructors).forEach(function(key) {
      if (key === "default" || key === "__esModule") return;
      if (key in exports && exports[key] === _constructors[key]) return;
      exports[key] = _constructors[key];
    });
    var _guards = requireGuards();
    Object.keys(_guards).forEach(function(key) {
      if (key === "default" || key === "__esModule") return;
      if (key in exports && exports[key] === _guards[key]) return;
      exports[key] = _guards[key];
    });
  })(selectors);
  return selectors;
}
var hasRequiredDist;
function requireDist() {
  if (hasRequiredDist) return dist.exports;
  hasRequiredDist = 1;
  (function(module, exports) {
    exports.__esModule = true;
    exports["default"] = void 0;
    var _processor = _interopRequireDefault(requireProcessor());
    var selectors2 = _interopRequireWildcard(requireSelectors());
    function _getRequireWildcardCache(nodeInterop) {
      if (typeof WeakMap !== "function") return null;
      var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
      var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
      return (_getRequireWildcardCache = function _getRequireWildcardCache2(nodeInterop2) {
        return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
      })(nodeInterop);
    }
    function _interopRequireWildcard(obj, nodeInterop) {
      if (obj && obj.__esModule) {
        return obj;
      }
      if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return { "default": obj };
      }
      var cache = _getRequireWildcardCache(nodeInterop);
      if (cache && cache.has(obj)) {
        return cache.get(obj);
      }
      var newObj = {};
      var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
      for (var key in obj) {
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
          var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
          if (desc && (desc.get || desc.set)) {
            Object.defineProperty(newObj, key, desc);
          } else {
            newObj[key] = obj[key];
          }
        }
      }
      newObj["default"] = obj;
      if (cache) {
        cache.set(obj, newObj);
      }
      return newObj;
    }
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    var parser2 = function parser3(processor2) {
      return new _processor["default"](processor2);
    };
    Object.assign(parser2, selectors2);
    delete parser2.__esModule;
    var _default = parser2;
    exports["default"] = _default;
    module.exports = exports.default;
  })(dist, dist.exports);
  return dist.exports;
}
var parse;
var hasRequiredParse;
function requireParse() {
  if (hasRequiredParse) return parse;
  hasRequiredParse = 1;
  var openParentheses = "(".charCodeAt(0);
  var closeParentheses = ")".charCodeAt(0);
  var singleQuote = "'".charCodeAt(0);
  var doubleQuote = '"'.charCodeAt(0);
  var backslash = "\\".charCodeAt(0);
  var slash = "/".charCodeAt(0);
  var comma = ",".charCodeAt(0);
  var colon = ":".charCodeAt(0);
  var star = "*".charCodeAt(0);
  var uLower = "u".charCodeAt(0);
  var uUpper = "U".charCodeAt(0);
  var plus = "+".charCodeAt(0);
  var isUnicodeRange = /^[a-f0-9?-]+$/i;
  parse = function(input2) {
    var tokens = [];
    var value = input2;
    var next, quote, prev, token, escape, escapePos, whitespacePos, parenthesesOpenPos;
    var pos = 0;
    var code = value.charCodeAt(pos);
    var max = value.length;
    var stack = [{ nodes: tokens }];
    var balanced = 0;
    var parent2;
    var name = "";
    var before = "";
    var after = "";
    while (pos < max) {
      if (code <= 32) {
        next = pos;
        do {
          next += 1;
          code = value.charCodeAt(next);
        } while (code <= 32);
        token = value.slice(pos, next);
        prev = tokens[tokens.length - 1];
        if (code === closeParentheses && balanced) {
          after = token;
        } else if (prev && prev.type === "div") {
          prev.after = token;
          prev.sourceEndIndex += token.length;
        } else if (code === comma || code === colon || code === slash && value.charCodeAt(next + 1) !== star && (!parent2 || parent2 && parent2.type === "function" && parent2.value !== "calc")) {
          before = token;
        } else {
          tokens.push({
            type: "space",
            sourceIndex: pos,
            sourceEndIndex: next,
            value: token
          });
        }
        pos = next;
      } else if (code === singleQuote || code === doubleQuote) {
        next = pos;
        quote = code === singleQuote ? "'" : '"';
        token = {
          type: "string",
          sourceIndex: pos,
          quote
        };
        do {
          escape = false;
          next = value.indexOf(quote, next + 1);
          if (~next) {
            escapePos = next;
            while (value.charCodeAt(escapePos - 1) === backslash) {
              escapePos -= 1;
              escape = !escape;
            }
          } else {
            value += quote;
            next = value.length - 1;
            token.unclosed = true;
          }
        } while (escape);
        token.value = value.slice(pos + 1, next);
        token.sourceEndIndex = token.unclosed ? next : next + 1;
        tokens.push(token);
        pos = next + 1;
        code = value.charCodeAt(pos);
      } else if (code === slash && value.charCodeAt(pos + 1) === star) {
        next = value.indexOf("*/", pos);
        token = {
          type: "comment",
          sourceIndex: pos,
          sourceEndIndex: next + 2
        };
        if (next === -1) {
          token.unclosed = true;
          next = value.length;
          token.sourceEndIndex = next;
        }
        token.value = value.slice(pos + 2, next);
        tokens.push(token);
        pos = next + 2;
        code = value.charCodeAt(pos);
      } else if ((code === slash || code === star) && parent2 && parent2.type === "function" && parent2.value === "calc") {
        token = value[pos];
        tokens.push({
          type: "word",
          sourceIndex: pos - before.length,
          sourceEndIndex: pos + token.length,
          value: token
        });
        pos += 1;
        code = value.charCodeAt(pos);
      } else if (code === slash || code === comma || code === colon) {
        token = value[pos];
        tokens.push({
          type: "div",
          sourceIndex: pos - before.length,
          sourceEndIndex: pos + token.length,
          value: token,
          before,
          after: ""
        });
        before = "";
        pos += 1;
        code = value.charCodeAt(pos);
      } else if (openParentheses === code) {
        next = pos;
        do {
          next += 1;
          code = value.charCodeAt(next);
        } while (code <= 32);
        parenthesesOpenPos = pos;
        token = {
          type: "function",
          sourceIndex: pos - name.length,
          value: name,
          before: value.slice(parenthesesOpenPos + 1, next)
        };
        pos = next;
        if (name === "url" && code !== singleQuote && code !== doubleQuote) {
          next -= 1;
          do {
            escape = false;
            next = value.indexOf(")", next + 1);
            if (~next) {
              escapePos = next;
              while (value.charCodeAt(escapePos - 1) === backslash) {
                escapePos -= 1;
                escape = !escape;
              }
            } else {
              value += ")";
              next = value.length - 1;
              token.unclosed = true;
            }
          } while (escape);
          whitespacePos = next;
          do {
            whitespacePos -= 1;
            code = value.charCodeAt(whitespacePos);
          } while (code <= 32);
          if (parenthesesOpenPos < whitespacePos) {
            if (pos !== whitespacePos + 1) {
              token.nodes = [
                {
                  type: "word",
                  sourceIndex: pos,
                  sourceEndIndex: whitespacePos + 1,
                  value: value.slice(pos, whitespacePos + 1)
                }
              ];
            } else {
              token.nodes = [];
            }
            if (token.unclosed && whitespacePos + 1 !== next) {
              token.after = "";
              token.nodes.push({
                type: "space",
                sourceIndex: whitespacePos + 1,
                sourceEndIndex: next,
                value: value.slice(whitespacePos + 1, next)
              });
            } else {
              token.after = value.slice(whitespacePos + 1, next);
              token.sourceEndIndex = next;
            }
          } else {
            token.after = "";
            token.nodes = [];
          }
          pos = next + 1;
          token.sourceEndIndex = token.unclosed ? next : pos;
          code = value.charCodeAt(pos);
          tokens.push(token);
        } else {
          balanced += 1;
          token.after = "";
          token.sourceEndIndex = pos + 1;
          tokens.push(token);
          stack.push(token);
          tokens = token.nodes = [];
          parent2 = token;
        }
        name = "";
      } else if (closeParentheses === code && balanced) {
        pos += 1;
        code = value.charCodeAt(pos);
        parent2.after = after;
        parent2.sourceEndIndex += after.length;
        after = "";
        balanced -= 1;
        stack[stack.length - 1].sourceEndIndex = pos;
        stack.pop();
        parent2 = stack[balanced];
        tokens = parent2.nodes;
      } else {
        next = pos;
        do {
          if (code === backslash) {
            next += 1;
          }
          next += 1;
          code = value.charCodeAt(next);
        } while (next < max && !(code <= 32 || code === singleQuote || code === doubleQuote || code === comma || code === colon || code === slash || code === openParentheses || code === star && parent2 && parent2.type === "function" && parent2.value === "calc" || code === slash && parent2.type === "function" && parent2.value === "calc" || code === closeParentheses && balanced));
        token = value.slice(pos, next);
        if (openParentheses === code) {
          name = token;
        } else if ((uLower === token.charCodeAt(0) || uUpper === token.charCodeAt(0)) && plus === token.charCodeAt(1) && isUnicodeRange.test(token.slice(2))) {
          tokens.push({
            type: "unicode-range",
            sourceIndex: pos,
            sourceEndIndex: next,
            value: token
          });
        } else {
          tokens.push({
            type: "word",
            sourceIndex: pos,
            sourceEndIndex: next,
            value: token
          });
        }
        pos = next;
      }
    }
    for (pos = stack.length - 1; pos; pos -= 1) {
      stack[pos].unclosed = true;
      stack[pos].sourceEndIndex = value.length;
    }
    return stack[0].nodes;
  };
  return parse;
}
var walk;
var hasRequiredWalk;
function requireWalk() {
  if (hasRequiredWalk) return walk;
  hasRequiredWalk = 1;
  walk = function walk2(nodes, cb, bubble) {
    var i, max, node2, result2;
    for (i = 0, max = nodes.length; i < max; i += 1) {
      node2 = nodes[i];
      if (!bubble) {
        result2 = cb(node2, i, nodes);
      }
      if (result2 !== false && node2.type === "function" && Array.isArray(node2.nodes)) {
        walk2(node2.nodes, cb, bubble);
      }
      if (bubble) {
        cb(node2, i, nodes);
      }
    }
  };
  return walk;
}
var stringify_1;
var hasRequiredStringify;
function requireStringify() {
  if (hasRequiredStringify) return stringify_1;
  hasRequiredStringify = 1;
  function stringifyNode(node2, custom) {
    var type = node2.type;
    var value = node2.value;
    var buf;
    var customResult;
    if (custom && (customResult = custom(node2)) !== void 0) {
      return customResult;
    } else if (type === "word" || type === "space") {
      return value;
    } else if (type === "string") {
      buf = node2.quote || "";
      return buf + value + (node2.unclosed ? "" : buf);
    } else if (type === "comment") {
      return "/*" + value + (node2.unclosed ? "" : "*/");
    } else if (type === "div") {
      return (node2.before || "") + value + (node2.after || "");
    } else if (Array.isArray(node2.nodes)) {
      buf = stringify(node2.nodes, custom);
      if (type !== "function") {
        return buf;
      }
      return value + "(" + (node2.before || "") + buf + (node2.after || "") + (node2.unclosed ? "" : ")");
    }
    return value;
  }
  function stringify(nodes, custom) {
    var result2, i;
    if (Array.isArray(nodes)) {
      result2 = "";
      for (i = nodes.length - 1; ~i; i -= 1) {
        result2 = stringifyNode(nodes[i], custom) + result2;
      }
      return result2;
    }
    return stringifyNode(nodes, custom);
  }
  stringify_1 = stringify;
  return stringify_1;
}
var unit;
var hasRequiredUnit;
function requireUnit() {
  if (hasRequiredUnit) return unit;
  hasRequiredUnit = 1;
  var minus = "-".charCodeAt(0);
  var plus = "+".charCodeAt(0);
  var dot = ".".charCodeAt(0);
  var exp = "e".charCodeAt(0);
  var EXP = "E".charCodeAt(0);
  function likeNumber(value) {
    var code = value.charCodeAt(0);
    var nextCode;
    if (code === plus || code === minus) {
      nextCode = value.charCodeAt(1);
      if (nextCode >= 48 && nextCode <= 57) {
        return true;
      }
      var nextNextCode = value.charCodeAt(2);
      if (nextCode === dot && nextNextCode >= 48 && nextNextCode <= 57) {
        return true;
      }
      return false;
    }
    if (code === dot) {
      nextCode = value.charCodeAt(1);
      if (nextCode >= 48 && nextCode <= 57) {
        return true;
      }
      return false;
    }
    if (code >= 48 && code <= 57) {
      return true;
    }
    return false;
  }
  unit = function(value) {
    var pos = 0;
    var length = value.length;
    var code;
    var nextCode;
    var nextNextCode;
    if (length === 0 || !likeNumber(value)) {
      return false;
    }
    code = value.charCodeAt(pos);
    if (code === plus || code === minus) {
      pos++;
    }
    while (pos < length) {
      code = value.charCodeAt(pos);
      if (code < 48 || code > 57) {
        break;
      }
      pos += 1;
    }
    code = value.charCodeAt(pos);
    nextCode = value.charCodeAt(pos + 1);
    if (code === dot && nextCode >= 48 && nextCode <= 57) {
      pos += 2;
      while (pos < length) {
        code = value.charCodeAt(pos);
        if (code < 48 || code > 57) {
          break;
        }
        pos += 1;
      }
    }
    code = value.charCodeAt(pos);
    nextCode = value.charCodeAt(pos + 1);
    nextNextCode = value.charCodeAt(pos + 2);
    if ((code === exp || code === EXP) && (nextCode >= 48 && nextCode <= 57 || (nextCode === plus || nextCode === minus) && nextNextCode >= 48 && nextNextCode <= 57)) {
      pos += nextCode === plus || nextCode === minus ? 3 : 2;
      while (pos < length) {
        code = value.charCodeAt(pos);
        if (code < 48 || code > 57) {
          break;
        }
        pos += 1;
      }
    }
    return {
      number: value.slice(0, pos),
      unit: value.slice(pos)
    };
  };
  return unit;
}
var lib;
var hasRequiredLib;
function requireLib() {
  if (hasRequiredLib) return lib;
  hasRequiredLib = 1;
  var parse2 = requireParse();
  var walk2 = requireWalk();
  var stringify = requireStringify();
  function ValueParser(value) {
    if (this instanceof ValueParser) {
      this.nodes = parse2(value);
      return this;
    }
    return new ValueParser(value);
  }
  ValueParser.prototype.toString = function() {
    return Array.isArray(this.nodes) ? stringify(this.nodes) : "";
  };
  ValueParser.prototype.walk = function(cb, bubble) {
    walk2(this.nodes, cb, bubble);
    return this;
  };
  ValueParser.unit = requireUnit();
  ValueParser.walk = walk2;
  ValueParser.stringify = stringify;
  lib = ValueParser;
  return lib;
}
function commonjsRequire(path) {
  throw new Error('Could not dynamically require "' + path + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
}
var parser = {};
var hasRequiredParser;
function requireParser() {
  if (hasRequiredParser) return parser;
  hasRequiredParser = 1;
  (function(exports) {
    var parser2 = function() {
      function JisonParserError(msg, hash) {
        Object.defineProperty(this, "name", {
          enumerable: false,
          writable: false,
          value: "JisonParserError"
        });
        if (msg == null) msg = "???";
        Object.defineProperty(this, "message", {
          enumerable: false,
          writable: true,
          value: msg
        });
        this.hash = hash;
        var stacktrace;
        if (hash && hash.exception instanceof Error) {
          var ex2 = hash.exception;
          this.message = ex2.message || msg;
          stacktrace = ex2.stack;
        }
        if (!stacktrace) {
          if (Error.hasOwnProperty("captureStackTrace")) {
            Error.captureStackTrace(this, this.constructor);
          } else {
            stacktrace = new Error(msg).stack;
          }
        }
        if (stacktrace) {
          Object.defineProperty(this, "stack", {
            enumerable: false,
            writable: false,
            value: stacktrace
          });
        }
      }
      if (typeof Object.setPrototypeOf === "function") {
        Object.setPrototypeOf(JisonParserError.prototype, Error.prototype);
      } else {
        JisonParserError.prototype = Object.create(Error.prototype);
      }
      JisonParserError.prototype.constructor = JisonParserError;
      JisonParserError.prototype.name = "JisonParserError";
      function bp(s2) {
        var rv = [];
        var p = s2.pop;
        var r = s2.rule;
        for (var i = 0, l2 = p.length; i < l2; i++) {
          rv.push([
            p[i],
            r[i]
          ]);
        }
        return rv;
      }
      function bda(s2) {
        var rv = {};
        var d = s2.idx;
        var g = s2.goto;
        for (var i = 0, l2 = d.length; i < l2; i++) {
          var j = d[i];
          rv[j] = g[i];
        }
        return rv;
      }
      function bt(s2) {
        var rv = [];
        var d = s2.len;
        var y = s2.symbol;
        var t = s2.type;
        var a = s2.state;
        var m = s2.mode;
        var g = s2.goto;
        for (var i = 0, l2 = d.length; i < l2; i++) {
          var n = d[i];
          var q = {};
          for (var j = 0; j < n; j++) {
            var z = y.shift();
            switch (t.shift()) {
              case 2:
                q[z] = [
                  m.shift(),
                  g.shift()
                ];
                break;
              case 0:
                q[z] = a.shift();
                break;
              default:
                q[z] = [
                  3
                ];
            }
          }
          rv.push(q);
        }
        return rv;
      }
      function s(c2, l2, a) {
        a = a || 0;
        for (var i = 0; i < l2; i++) {
          this.push(c2);
          c2 += a;
        }
      }
      function c(i, l2) {
        i = this.length - i;
        for (l2 += i; i < l2; i++) {
          this.push(this[i]);
        }
      }
      function u(a) {
        var rv = [];
        for (var i = 0, l2 = a.length; i < l2; i++) {
          var e2 = a[i];
          if (typeof e2 === "function") {
            i++;
            e2.apply(rv, a[i]);
          } else {
            rv.push(e2);
          }
        }
        return rv;
      }
      var parser3 = {
        // Code Generator Information Report
        // ---------------------------------
        //
        // Options:
        //
        //   default action mode: ............. ["classic","merge"]
        //   test-compile action mode: ........ "parser:*,lexer:*"
        //   try..catch: ...................... true
        //   default resolve on conflict: ..... true
        //   on-demand look-ahead: ............ false
        //   error recovery token skip maximum: 3
        //   yyerror in parse actions is: ..... NOT recoverable,
        //   yyerror in lexer actions and other non-fatal lexer are:
        //   .................................. NOT recoverable,
        //   debug grammar/output: ............ false
        //   has partial LR conflict upgrade:   true
        //   rudimentary token-stack support:   false
        //   parser table compression mode: ... 2
        //   export debug tables: ............. false
        //   export *all* tables: ............. false
        //   module type: ..................... commonjs
        //   parser engine type: .............. lalr
        //   output main() in the module: ..... true
        //   has user-specified main(): ....... false
        //   has user-specified require()/import modules for main():
        //   .................................. false
        //   number of expected conflicts: .... 0
        //
        //
        // Parser Analysis flags:
        //
        //   no significant actions (parser is a language matcher only):
        //   .................................. false
        //   uses yyleng: ..................... false
        //   uses yylineno: ................... false
        //   uses yytext: ..................... false
        //   uses yylloc: ..................... false
        //   uses ParseError API: ............. false
        //   uses YYERROR: .................... false
        //   uses YYRECOVERING: ............... false
        //   uses YYERROK: .................... false
        //   uses YYCLEARIN: .................. false
        //   tracks rule values: .............. true
        //   assigns rule values: ............. true
        //   uses location tracking: .......... false
        //   assigns location: ................ false
        //   uses yystack: .................... false
        //   uses yysstack: ................... false
        //   uses yysp: ....................... true
        //   uses yyrulelength: ............... false
        //   uses yyMergeLocationInfo API: .... false
        //   has error recovery: .............. false
        //   has error reporting: ............. false
        //
        // --------- END OF REPORT -----------
        trace: function no_op_trace() {
        },
        JisonParserError,
        yy: {},
        options: {
          type: "lalr",
          hasPartialLrUpgradeOnConflict: true,
          errorRecoveryTokenDiscardCount: 3
        },
        symbols_: {
          "$accept": 0,
          "$end": 1,
          "ADD": 6,
          "ANGLE": 12,
          "CALC": 3,
          "CALC_KEYWORD": 54,
          "CHS": 19,
          "CQBS": 48,
          "CQHS": 46,
          "CQIS": 47,
          "CQMAXS": 50,
          "CQMINS": 49,
          "CQWS": 45,
          "DIV": 9,
          "DVBS": 40,
          "DVHS": 24,
          "DVIS": 44,
          "DVMAXS": 36,
          "DVMINS": 32,
          "DVWS": 28,
          "EMS": 17,
          "EOF": 1,
          "EXS": 18,
          "FREQ": 14,
          "FUNCTION": 10,
          "LENGTH": 11,
          "LHS": 51,
          "LPAREN": 4,
          "LVBS": 39,
          "LVHS": 23,
          "LVIS": 43,
          "LVMAXS": 35,
          "LVMINS": 31,
          "LVWS": 27,
          "MUL": 8,
          "NUMBER": 55,
          "PERCENTAGE": 53,
          "REMS": 20,
          "RES": 15,
          "RLHS": 52,
          "RPAREN": 5,
          "SUB": 7,
          "SVBS": 38,
          "SVHS": 22,
          "SVIS": 42,
          "SVMAXS": 34,
          "SVMINS": 30,
          "SVWS": 26,
          "TIME": 13,
          "UNKNOWN_DIMENSION": 16,
          "VBS": 37,
          "VHS": 21,
          "VIS": 41,
          "VMAXS": 33,
          "VMINS": 29,
          "VWS": 25,
          "calc_keyword": 60,
          "dimension": 59,
          "error": 2,
          "expression": 56,
          "function": 58,
          "math_expression": 57,
          "number": 61
        },
        terminals_: {
          1: "EOF",
          2: "error",
          3: "CALC",
          4: "LPAREN",
          5: "RPAREN",
          6: "ADD",
          7: "SUB",
          8: "MUL",
          9: "DIV",
          10: "FUNCTION",
          11: "LENGTH",
          12: "ANGLE",
          13: "TIME",
          14: "FREQ",
          15: "RES",
          16: "UNKNOWN_DIMENSION",
          17: "EMS",
          18: "EXS",
          19: "CHS",
          20: "REMS",
          21: "VHS",
          22: "SVHS",
          23: "LVHS",
          24: "DVHS",
          25: "VWS",
          26: "SVWS",
          27: "LVWS",
          28: "DVWS",
          29: "VMINS",
          30: "SVMINS",
          31: "LVMINS",
          32: "DVMINS",
          33: "VMAXS",
          34: "SVMAXS",
          35: "LVMAXS",
          36: "DVMAXS",
          37: "VBS",
          38: "SVBS",
          39: "LVBS",
          40: "DVBS",
          41: "VIS",
          42: "SVIS",
          43: "LVIS",
          44: "DVIS",
          45: "CQWS",
          46: "CQHS",
          47: "CQIS",
          48: "CQBS",
          49: "CQMINS",
          50: "CQMAXS",
          51: "LHS",
          52: "RLHS",
          53: "PERCENTAGE",
          54: "CALC_KEYWORD",
          55: "NUMBER"
        },
        TERROR: 2,
        EOF: 1,
        // internals: defined here so the object *structure* doesn't get modified by parse() et al,
        // thus helping JIT compilers like Chrome V8.
        originalQuoteName: null,
        originalParseError: null,
        cleanupAfterParse: null,
        constructParseErrorInfo: null,
        yyMergeLocationInfo: null,
        __reentrant_call_depth: 0,
        // INTERNAL USE ONLY
        __error_infos: [],
        // INTERNAL USE ONLY: the set of parseErrorInfo objects created since the last cleanup
        __error_recovery_infos: [],
        // INTERNAL USE ONLY: the set of parseErrorInfo objects created since the last cleanup
        // APIs which will be set up depending on user action code analysis:
        //yyRecovering: 0,
        //yyErrOk: 0,
        //yyClearIn: 0,
        // Helper APIs
        // -----------
        // Helper function which can be overridden by user code later on: put suitable quotes around
        // literal IDs in a description string.
        quoteName: function parser_quoteName(id_str) {
          return '"' + id_str + '"';
        },
        // Return the name of the given symbol (terminal or non-terminal) as a string, when available.
        //
        // Return NULL when the symbol is unknown to the parser.
        getSymbolName: function parser_getSymbolName(symbol) {
          if (this.terminals_[symbol]) {
            return this.terminals_[symbol];
          }
          var s2 = this.symbols_;
          for (var key in s2) {
            if (s2[key] === symbol) {
              return key;
            }
          }
          return null;
        },
        // Return a more-or-less human-readable description of the given symbol, when available,
        // or the symbol itself, serving as its own 'description' for lack of something better to serve up.
        //
        // Return NULL when the symbol is unknown to the parser.
        describeSymbol: function parser_describeSymbol(symbol) {
          if (symbol !== this.EOF && this.terminal_descriptions_ && this.terminal_descriptions_[symbol]) {
            return this.terminal_descriptions_[symbol];
          } else if (symbol === this.EOF) {
            return "end of input";
          }
          var id2 = this.getSymbolName(symbol);
          if (id2) {
            return this.quoteName(id2);
          }
          return null;
        },
        // Produce a (more or less) human-readable list of expected tokens at the point of failure.
        //
        // The produced list may contain token or token set descriptions instead of the tokens
        // themselves to help turning this output into something that easier to read by humans
        // unless `do_not_describe` parameter is set, in which case a list of the raw, *numeric*,
        // expected terminals and nonterminals is produced.
        //
        // The returned list (array) will not contain any duplicate entries.
        collect_expected_token_set: function parser_collect_expected_token_set(state, do_not_describe) {
          var TERROR = this.TERROR;
          var tokenset = [];
          var check = {};
          if (!do_not_describe && this.state_descriptions_ && this.state_descriptions_[state]) {
            return [
              this.state_descriptions_[state]
            ];
          }
          for (var p in this.table[state]) {
            p = +p;
            if (p !== TERROR) {
              var d = do_not_describe ? p : this.describeSymbol(p);
              if (d && !check[d]) {
                tokenset.push(d);
                check[d] = true;
              }
            }
          }
          return tokenset;
        },
        productions_: bp({
          pop: u([
            56,
            s,
            [57, 10],
            58,
            s,
            [59, 45],
            60,
            s,
            [61, 3]
          ]),
          rule: u([
            2,
            4,
            s,
            [3, 5],
            s,
            [1, 48],
            2,
            2,
            c,
            [4, 4]
          ])
        }),
        performAction: function parser__PerformAction(yystate, yysp, yyvstack) {
          var yy = this.yy;
          yy.parser;
          yy.lexer;
          switch (yystate) {
            case 0:
              this.$ = yyvstack[yysp - 1];
              break;
            case 1:
              this.$ = yyvstack[yysp - 1];
              return yyvstack[yysp - 1];
            case 2:
              this.$ = yyvstack[yysp - 1];
              break;
            case 3:
            /*! Production::    math_expression : math_expression ADD math_expression */
            case 4:
            /*! Production::    math_expression : math_expression SUB math_expression */
            case 5:
            /*! Production::    math_expression : math_expression MUL math_expression */
            case 6:
              this.$ = { type: "MathExpression", operator: yyvstack[yysp - 1], left: yyvstack[yysp - 2], right: yyvstack[yysp] };
              break;
            case 7:
              this.$ = { type: "ParenthesizedExpression", content: yyvstack[yysp - 1] };
              break;
            case 8:
            /*! Production::    math_expression : function */
            case 9:
            /*! Production::    math_expression : dimension */
            case 10:
            /*! Production::    math_expression : number */
            case 11:
              this.$ = yyvstack[yysp];
              break;
            case 12:
              this.$ = { type: "Function", value: yyvstack[yysp] };
              break;
            case 13:
              this.$ = { type: "LengthValue", value: parseFloat(yyvstack[yysp]), unit: /[a-z]+$/i.exec(yyvstack[yysp])[0] };
              break;
            case 14:
              this.$ = { type: "AngleValue", value: parseFloat(yyvstack[yysp]), unit: /[a-z]+$/i.exec(yyvstack[yysp])[0] };
              break;
            case 15:
              this.$ = { type: "TimeValue", value: parseFloat(yyvstack[yysp]), unit: /[a-z]+$/i.exec(yyvstack[yysp])[0] };
              break;
            case 16:
              this.$ = { type: "FrequencyValue", value: parseFloat(yyvstack[yysp]), unit: /[a-z]+$/i.exec(yyvstack[yysp])[0] };
              break;
            case 17:
              this.$ = { type: "ResolutionValue", value: parseFloat(yyvstack[yysp]), unit: /[a-z]+$/i.exec(yyvstack[yysp])[0] };
              break;
            case 18:
              this.$ = { type: "UnknownDimension", value: parseFloat(yyvstack[yysp]), unit: /[a-z]+$/i.exec(yyvstack[yysp])[0] };
              break;
            case 19:
              this.$ = { type: "EmValue", value: parseFloat(yyvstack[yysp]), unit: "em" };
              break;
            case 20:
              this.$ = { type: "ExValue", value: parseFloat(yyvstack[yysp]), unit: "ex" };
              break;
            case 21:
              this.$ = { type: "ChValue", value: parseFloat(yyvstack[yysp]), unit: "ch" };
              break;
            case 22:
              this.$ = { type: "RemValue", value: parseFloat(yyvstack[yysp]), unit: "rem" };
              break;
            case 23:
              this.$ = { type: "VhValue", value: parseFloat(yyvstack[yysp]), unit: "vh" };
              break;
            case 24:
              this.$ = { type: "SvhValue", value: parseFloat(yyvstack[yysp]), unit: "svh" };
              break;
            case 25:
              this.$ = { type: "LvhValue", value: parseFloat(yyvstack[yysp]), unit: "lvh" };
              break;
            case 26:
              this.$ = { type: "DvhValue", value: parseFloat(yyvstack[yysp]), unit: "dvh" };
              break;
            case 27:
              this.$ = { type: "VwValue", value: parseFloat(yyvstack[yysp]), unit: "vw" };
              break;
            case 28:
              this.$ = { type: "SvwValue", value: parseFloat(yyvstack[yysp]), unit: "svw" };
              break;
            case 29:
              this.$ = { type: "LvwValue", value: parseFloat(yyvstack[yysp]), unit: "lvw" };
              break;
            case 30:
              this.$ = { type: "DvwValue", value: parseFloat(yyvstack[yysp]), unit: "dvw" };
              break;
            case 31:
              this.$ = { type: "VminValue", value: parseFloat(yyvstack[yysp]), unit: "vmin" };
              break;
            case 32:
              this.$ = { type: "SvminValue", value: parseFloat(yyvstack[yysp]), unit: "svmin" };
              break;
            case 33:
              this.$ = { type: "LvminValue", value: parseFloat(yyvstack[yysp]), unit: "lvmin" };
              break;
            case 34:
              this.$ = { type: "DvminValue", value: parseFloat(yyvstack[yysp]), unit: "dvmin" };
              break;
            case 35:
              this.$ = { type: "VmaxValue", value: parseFloat(yyvstack[yysp]), unit: "vmax" };
              break;
            case 36:
              this.$ = { type: "SvmaxValue", value: parseFloat(yyvstack[yysp]), unit: "svmax" };
              break;
            case 37:
              this.$ = { type: "LvmaxValue", value: parseFloat(yyvstack[yysp]), unit: "lvmax" };
              break;
            case 38:
              this.$ = { type: "DvmaxValue", value: parseFloat(yyvstack[yysp]), unit: "dvmax" };
              break;
            case 39:
              this.$ = { type: "VbValue", value: parseFloat(yyvstack[yysp]), unit: "vb" };
              break;
            case 40:
              this.$ = { type: "SvbValue", value: parseFloat(yyvstack[yysp]), unit: "svb" };
              break;
            case 41:
              this.$ = { type: "LvbValue", value: parseFloat(yyvstack[yysp]), unit: "lvb" };
              break;
            case 42:
              this.$ = { type: "DvbValue", value: parseFloat(yyvstack[yysp]), unit: "dvb" };
              break;
            case 43:
              this.$ = { type: "VhValue", value: parseFloat(yyvstack[yysp]), unit: "vi" };
              break;
            case 44:
              this.$ = { type: "SvhValue", value: parseFloat(yyvstack[yysp]), unit: "svi" };
              break;
            case 45:
              this.$ = { type: "LvhValue", value: parseFloat(yyvstack[yysp]), unit: "lvi" };
              break;
            case 46:
              this.$ = { type: "DvhValue", value: parseFloat(yyvstack[yysp]), unit: "dvi" };
              break;
            case 47:
              this.$ = { type: "CqwValue", value: parseFloat(yyvstack[yysp]), unit: "cqw" };
              break;
            case 48:
              this.$ = { type: "CqhValue", value: parseFloat(yyvstack[yysp]), unit: "cqh" };
              break;
            case 49:
              this.$ = { type: "CqiValue", value: parseFloat(yyvstack[yysp]), unit: "cqi" };
              break;
            case 50:
              this.$ = { type: "CqbValue", value: parseFloat(yyvstack[yysp]), unit: "cqb" };
              break;
            case 51:
              this.$ = { type: "CqminValue", value: parseFloat(yyvstack[yysp]), unit: "cqmin" };
              break;
            case 52:
              this.$ = { type: "CqmaxValue", value: parseFloat(yyvstack[yysp]), unit: "cqmax" };
              break;
            case 53:
              this.$ = { type: "LhValue", value: parseFloat(yyvstack[yysp]), unit: "lh" };
              break;
            case 54:
              this.$ = { type: "RlhValue", value: parseFloat(yyvstack[yysp]), unit: "rlh" };
              break;
            case 55:
              this.$ = { type: "PercentageValue", value: parseFloat(yyvstack[yysp]), unit: "%" };
              break;
            case 56:
              var prev = yyvstack[yysp];
              this.$ = prev;
              break;
            case 57:
              var prev = yyvstack[yysp];
              prev.value *= -1;
              this.$ = prev;
              break;
            case 58:
              this.$ = { type: "CalcKeyword", value: yyvstack[yysp] };
              break;
            case 59:
            /*! Production::    number : NUMBER */
            case 60:
              this.$ = { type: "Number", value: parseFloat(yyvstack[yysp]) };
              break;
            case 61:
              this.$ = { type: "Number", value: parseFloat(yyvstack[yysp]) * -1 };
              break;
          }
        },
        table: bt({
          len: u([
            56,
            1,
            5,
            1,
            55,
            s,
            [0, 48],
            47,
            47,
            s,
            [0, 3],
            s,
            [55, 5],
            5,
            0,
            0,
            46,
            46,
            0,
            0,
            6,
            6,
            0,
            0,
            c,
            [11, 3]
          ]),
          symbol: u([
            3,
            4,
            6,
            7,
            s,
            [10, 52, 1],
            1,
            1,
            s,
            [6, 4, 1],
            4,
            c,
            [63, 50],
            c,
            [62, 5],
            6,
            7,
            c,
            [52, 43],
            55,
            59,
            c,
            [47, 47],
            c,
            [149, 55],
            c,
            [55, 220],
            s,
            [5, 5, 1],
            c,
            [327, 45],
            c,
            [373, 46],
            59,
            1,
            c,
            [98, 5],
            c,
            [6, 6],
            c,
            [5, 5]
          ]),
          type: u([
            s,
            [2, 50],
            s,
            [0, 6],
            1,
            s,
            [2, 56],
            s,
            [0, 5],
            c,
            [51, 47],
            c,
            [47, 93],
            c,
            [149, 55],
            c,
            [55, 225],
            c,
            [46, 63]
          ]),
          state: u([
            1,
            2,
            5,
            6,
            8,
            7,
            63,
            c,
            [5, 4],
            64,
            68,
            70,
            c,
            [7, 4],
            71,
            c,
            [5, 4],
            72,
            c,
            [5, 4],
            73,
            c,
            [5, 4],
            74,
            c,
            [27, 6]
          ]),
          mode: u([
            s,
            [1, 543],
            s,
            [2, 4],
            c,
            [6, 8],
            s,
            [1, 5]
          ]),
          goto: u([
            3,
            4,
            53,
            54,
            s,
            [9, 44, 1],
            56,
            55,
            s,
            [57, 6, 1],
            c,
            [56, 50],
            66,
            67,
            c,
            [47, 43],
            65,
            c,
            [46, 45],
            69,
            c,
            [142, 50],
            c,
            [50, 200],
            75,
            c,
            [398, 4],
            c,
            [301, 45],
            c,
            [45, 45],
            s,
            [3, 4],
            60,
            61,
            s,
            [4, 4],
            60,
            61,
            76,
            c,
            [107, 4]
          ])
        }),
        defaultActions: bda({
          idx: u([
            s,
            [5, 48, 1],
            55,
            56,
            57,
            64,
            65,
            68,
            69,
            72,
            73,
            75,
            76
          ]),
          goto: u([
            s,
            [8, 48, 1],
            59,
            58,
            1,
            56,
            60,
            57,
            61,
            5,
            6,
            7,
            2
          ])
        }),
        parseError: function parseError(str, hash, ExceptionClass) {
          if (hash.recoverable) {
            if (typeof this.trace === "function") {
              this.trace(str);
            }
            hash.destroy();
          } else {
            if (typeof this.trace === "function") {
              this.trace(str);
            }
            if (!ExceptionClass) {
              ExceptionClass = this.JisonParserError;
            }
            throw new ExceptionClass(str, hash);
          }
        },
        parse: function parse2(input2) {
          var self2 = this;
          var stack = new Array(128);
          var sstack = new Array(128);
          var vstack = new Array(128);
          var table = this.table;
          var sp = 0;
          var symbol = 0;
          this.TERROR;
          var EOF = this.EOF;
          this.options.errorRecoveryTokenDiscardCount | 0 || 3;
          var NO_ACTION = [
            0,
            77
            /* === table.length :: ensures that anyone using this new state will fail dramatically! */
          ];
          var lexer2;
          if (this.__lexer__) {
            lexer2 = this.__lexer__;
          } else {
            lexer2 = this.__lexer__ = Object.create(this.lexer);
          }
          var sharedState_yy = {
            parseError: void 0,
            quoteName: void 0,
            lexer: void 0,
            parser: void 0,
            pre_parse: void 0,
            post_parse: void 0,
            pre_lex: void 0,
            post_lex: void 0
            // WARNING: must be written this way for the code expanders to work correctly in both ES5 and ES6 modes!
          };
          if (typeof assert !== "function") ;
          else {
            assert;
          }
          this.yyGetSharedState = function yyGetSharedState() {
            return sharedState_yy;
          };
          function shallow_copy_noclobber(dst, src2) {
            for (var k in src2) {
              if (typeof dst[k] === "undefined" && Object.prototype.hasOwnProperty.call(src2, k)) {
                dst[k] = src2[k];
              }
            }
          }
          shallow_copy_noclobber(sharedState_yy, this.yy);
          sharedState_yy.lexer = lexer2;
          sharedState_yy.parser = this;
          if (typeof sharedState_yy.parseError === "function") {
            this.parseError = function parseErrorAlt(str, hash, ExceptionClass) {
              if (!ExceptionClass) {
                ExceptionClass = this.JisonParserError;
              }
              return sharedState_yy.parseError.call(this, str, hash, ExceptionClass);
            };
          } else {
            this.parseError = this.originalParseError;
          }
          if (typeof sharedState_yy.quoteName === "function") {
            this.quoteName = function quoteNameAlt(id_str) {
              return sharedState_yy.quoteName.call(this, id_str);
            };
          } else {
            this.quoteName = this.originalQuoteName;
          }
          this.cleanupAfterParse = function parser_cleanupAfterParse(resultValue, invoke_post_methods, do_not_nuke_errorinfos) {
            var rv;
            if (invoke_post_methods) {
              var hash;
              if (sharedState_yy.post_parse || this.post_parse) {
                hash = this.constructParseErrorInfo(null, null, null, false);
              }
              if (sharedState_yy.post_parse) {
                rv = sharedState_yy.post_parse.call(this, sharedState_yy, resultValue, hash);
                if (typeof rv !== "undefined") resultValue = rv;
              }
              if (this.post_parse) {
                rv = this.post_parse.call(this, sharedState_yy, resultValue, hash);
                if (typeof rv !== "undefined") resultValue = rv;
              }
              if (hash && hash.destroy) {
                hash.destroy();
              }
            }
            if (this.__reentrant_call_depth > 1) return resultValue;
            if (lexer2.cleanupAfterLex) {
              lexer2.cleanupAfterLex(do_not_nuke_errorinfos);
            }
            if (sharedState_yy) {
              sharedState_yy.lexer = void 0;
              sharedState_yy.parser = void 0;
              if (lexer2.yy === sharedState_yy) {
                lexer2.yy = void 0;
              }
            }
            sharedState_yy = void 0;
            this.parseError = this.originalParseError;
            this.quoteName = this.originalQuoteName;
            stack.length = 0;
            sstack.length = 0;
            vstack.length = 0;
            sp = 0;
            if (!do_not_nuke_errorinfos) {
              for (var i = this.__error_infos.length - 1; i >= 0; i--) {
                var el = this.__error_infos[i];
                if (el && typeof el.destroy === "function") {
                  el.destroy();
                }
              }
              this.__error_infos.length = 0;
            }
            return resultValue;
          };
          this.constructParseErrorInfo = function parser_constructParseErrorInfo(msg, ex, expected2, recoverable) {
            var pei = {
              errStr: msg,
              exception: ex,
              text: lexer2.match,
              value: lexer2.yytext,
              token: this.describeSymbol(symbol) || symbol,
              token_id: symbol,
              line: lexer2.yylineno,
              expected: expected2,
              recoverable,
              state,
              action,
              new_state: newState,
              symbol_stack: stack,
              state_stack: sstack,
              value_stack: vstack,
              stack_pointer: sp,
              yy: sharedState_yy,
              lexer: lexer2,
              parser: this,
              // and make sure the error info doesn't stay due to potential
              // ref cycle via userland code manipulations.
              // These would otherwise all be memory leak opportunities!
              //
              // Note that only array and object references are nuked as those
              // constitute the set of elements which can produce a cyclic ref.
              // The rest of the members is kept intact as they are harmless.
              destroy: function destructParseErrorInfo() {
                var rec = !!this.recoverable;
                for (var key in this) {
                  if (this.hasOwnProperty(key) && typeof key === "object") {
                    this[key] = void 0;
                  }
                }
                this.recoverable = rec;
              }
            };
            this.__error_infos.push(pei);
            return pei;
          };
          function stdLex() {
            var token = lexer2.lex();
            if (typeof token !== "number") {
              token = self2.symbols_[token] || token;
            }
            return token || EOF;
          }
          function fastLex() {
            var token = lexer2.fastLex();
            if (typeof token !== "number") {
              token = self2.symbols_[token] || token;
            }
            return token || EOF;
          }
          var lex = stdLex;
          var state, action, r, t;
          var yyval = {
            $: true,
            _$: void 0,
            yy: sharedState_yy
          };
          var p;
          var yyrulelen;
          var this_production;
          var newState;
          var retval = false;
          try {
            this.__reentrant_call_depth++;
            lexer2.setInput(input2, sharedState_yy);
            if (typeof lexer2.canIUse === "function") {
              var lexerInfo = lexer2.canIUse();
              if (lexerInfo.fastLex && typeof fastLex === "function") {
                lex = fastLex;
              }
            }
            vstack[sp] = null;
            sstack[sp] = 0;
            stack[sp] = 0;
            ++sp;
            if (this.pre_parse) {
              this.pre_parse.call(this, sharedState_yy);
            }
            if (sharedState_yy.pre_parse) {
              sharedState_yy.pre_parse.call(this, sharedState_yy);
            }
            newState = sstack[sp - 1];
            for (; ; ) {
              state = newState;
              if (this.defaultActions[state]) {
                action = 2;
                newState = this.defaultActions[state];
              } else {
                if (!symbol) {
                  symbol = lex();
                }
                t = table[state] && table[state][symbol] || NO_ACTION;
                newState = t[1];
                action = t[0];
                if (!action) {
                  var errStr;
                  var errSymbolDescr = this.describeSymbol(symbol) || symbol;
                  var expected = this.collect_expected_token_set(state);
                  if (typeof lexer2.yylineno === "number") {
                    errStr = "Parse error on line " + (lexer2.yylineno + 1) + ": ";
                  } else {
                    errStr = "Parse error: ";
                  }
                  if (typeof lexer2.showPosition === "function") {
                    errStr += "\n" + lexer2.showPosition(79 - 10, 10) + "\n";
                  }
                  if (expected.length) {
                    errStr += "Expecting " + expected.join(", ") + ", got unexpected " + errSymbolDescr;
                  } else {
                    errStr += "Unexpected " + errSymbolDescr;
                  }
                  p = this.constructParseErrorInfo(errStr, null, expected, false);
                  r = this.parseError(p.errStr, p, this.JisonParserError);
                  if (typeof r !== "undefined") {
                    retval = r;
                  }
                  break;
                }
              }
              switch (action) {
                // catch misc. parse failures:
                default:
                  if (action instanceof Array) {
                    p = this.constructParseErrorInfo("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol, null, null, false);
                    r = this.parseError(p.errStr, p, this.JisonParserError);
                    if (typeof r !== "undefined") {
                      retval = r;
                    }
                    break;
                  }
                  p = this.constructParseErrorInfo("Parsing halted. No viable error recovery approach available due to internal system failure.", null, null, false);
                  r = this.parseError(p.errStr, p, this.JisonParserError);
                  if (typeof r !== "undefined") {
                    retval = r;
                  }
                  break;
                // shift:
                case 1:
                  stack[sp] = symbol;
                  vstack[sp] = lexer2.yytext;
                  sstack[sp] = newState;
                  ++sp;
                  symbol = 0;
                  continue;
                // reduce:
                case 2:
                  this_production = this.productions_[newState - 1];
                  yyrulelen = this_production[1];
                  r = this.performAction.call(yyval, newState, sp - 1, vstack);
                  if (typeof r !== "undefined") {
                    retval = r;
                    break;
                  }
                  sp -= yyrulelen;
                  var ntsymbol = this_production[0];
                  stack[sp] = ntsymbol;
                  vstack[sp] = yyval.$;
                  newState = table[sstack[sp - 1]][ntsymbol];
                  sstack[sp] = newState;
                  ++sp;
                  continue;
                // accept:
                case 3:
                  if (sp !== -2) {
                    retval = true;
                    sp--;
                    if (typeof vstack[sp] !== "undefined") {
                      retval = vstack[sp];
                    }
                  }
                  break;
              }
              break;
            }
          } catch (ex) {
            if (ex instanceof this.JisonParserError) {
              throw ex;
            } else if (lexer2 && typeof lexer2.JisonLexerError === "function" && ex instanceof lexer2.JisonLexerError) {
              throw ex;
            }
            p = this.constructParseErrorInfo("Parsing aborted due to exception.", ex, null, false);
            retval = false;
            r = this.parseError(p.errStr, p, this.JisonParserError);
            if (typeof r !== "undefined") {
              retval = r;
            }
          } finally {
            retval = this.cleanupAfterParse(retval, true, true);
            this.__reentrant_call_depth--;
          }
          return retval;
        }
      };
      parser3.originalParseError = parser3.parseError;
      parser3.originalQuoteName = parser3.quoteName;
      var lexer = function() {
        function JisonLexerError(msg, hash) {
          Object.defineProperty(this, "name", {
            enumerable: false,
            writable: false,
            value: "JisonLexerError"
          });
          if (msg == null)
            msg = "???";
          Object.defineProperty(this, "message", {
            enumerable: false,
            writable: true,
            value: msg
          });
          this.hash = hash;
          var stacktrace;
          if (hash && hash.exception instanceof Error) {
            var ex2 = hash.exception;
            this.message = ex2.message || msg;
            stacktrace = ex2.stack;
          }
          if (!stacktrace) {
            if (Error.hasOwnProperty("captureStackTrace")) {
              Error.captureStackTrace(this, this.constructor);
            } else {
              stacktrace = new Error(msg).stack;
            }
          }
          if (stacktrace) {
            Object.defineProperty(this, "stack", {
              enumerable: false,
              writable: false,
              value: stacktrace
            });
          }
        }
        if (typeof Object.setPrototypeOf === "function") {
          Object.setPrototypeOf(JisonLexerError.prototype, Error.prototype);
        } else {
          JisonLexerError.prototype = Object.create(Error.prototype);
        }
        JisonLexerError.prototype.constructor = JisonLexerError;
        JisonLexerError.prototype.name = "JisonLexerError";
        var lexer2 = {
          // Code Generator Information Report
          // ---------------------------------
          //
          // Options:
          //
          //   backtracking: .................... false
          //   location.ranges: ................. false
          //   location line+column tracking: ... true
          //
          //
          // Forwarded Parser Analysis flags:
          //
          //   uses yyleng: ..................... false
          //   uses yylineno: ................... false
          //   uses yytext: ..................... false
          //   uses yylloc: ..................... false
          //   uses lexer values: ............... true / true
          //   location tracking: ............... false
          //   location assignment: ............. false
          //
          //
          // Lexer Analysis flags:
          //
          //   uses yyleng: ..................... ???
          //   uses yylineno: ................... ???
          //   uses yytext: ..................... ???
          //   uses yylloc: ..................... ???
          //   uses ParseError API: ............. ???
          //   uses yyerror: .................... ???
          //   uses location tracking & editing:  ???
          //   uses more() API: ................. ???
          //   uses unput() API: ................ ???
          //   uses reject() API: ............... ???
          //   uses less() API: ................. ???
          //   uses display APIs pastInput(), upcomingInput(), showPosition():
          //        ............................. ???
          //   uses describeYYLLOC() API: ....... ???
          //
          // --------- END OF REPORT -----------
          EOF: 1,
          ERROR: 2,
          // JisonLexerError: JisonLexerError,        /// <-- injected by the code generator
          // options: {},                             /// <-- injected by the code generator
          // yy: ...,                                 /// <-- injected by setInput()
          __currentRuleSet__: null,
          /// INTERNAL USE ONLY: internal rule set cache for the current lexer state  
          __error_infos: [],
          /// INTERNAL USE ONLY: the set of lexErrorInfo objects created since the last cleanup  
          __decompressed: false,
          /// INTERNAL USE ONLY: mark whether the lexer instance has been 'unfolded' completely and is now ready for use  
          done: false,
          /// INTERNAL USE ONLY  
          _backtrack: false,
          /// INTERNAL USE ONLY  
          _input: "",
          /// INTERNAL USE ONLY  
          _more: false,
          /// INTERNAL USE ONLY  
          _signaled_error_token: false,
          /// INTERNAL USE ONLY  
          conditionStack: [],
          /// INTERNAL USE ONLY; managed via `pushState()`, `popState()`, `topState()` and `stateStackSize()`  
          match: "",
          /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks input which has been matched so far for the lexer token under construction. `match` is identical to `yytext` except that this one still contains the matched input string after `lexer.performAction()` has been invoked, where userland code MAY have changed/replaced the `yytext` value entirely!  
          matched: "",
          /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks entire input which has been matched so far  
          matches: false,
          /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks RE match result for last (successful) match attempt  
          yytext: "",
          /// ADVANCED USE ONLY: tracks input which has been matched so far for the lexer token under construction; this value is transferred to the parser as the 'token value' when the parser consumes the lexer token produced through a call to the `lex()` API.  
          offset: 0,
          /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks the 'cursor position' in the input string, i.e. the number of characters matched so far  
          yyleng: 0,
          /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: length of matched input for the token under construction (`yytext`)  
          yylineno: 0,
          /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: 'line number' at which the token under construction is located  
          yylloc: null,
          /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks location info (lines + columns) for the token under construction  
          /**
           * INTERNAL USE: construct a suitable error info hash object instance for `parseError`.
           * 
           * @public
           * @this {RegExpLexer}
           */
          constructLexErrorInfo: function lexer_constructLexErrorInfo(msg, recoverable, show_input_position) {
            msg = "" + msg;
            if (show_input_position == void 0) {
              show_input_position = !(msg.indexOf("\n") > 0 && msg.indexOf("^") > 0);
            }
            if (this.yylloc && show_input_position) {
              if (typeof this.prettyPrintRange === "function") {
                this.prettyPrintRange(this.yylloc);
                if (!/\n\s*$/.test(msg)) {
                  msg += "\n";
                }
                msg += "\n  Erroneous area:\n" + this.prettyPrintRange(this.yylloc);
              } else if (typeof this.showPosition === "function") {
                var pos_str = this.showPosition();
                if (pos_str) {
                  if (msg.length && msg[msg.length - 1] !== "\n" && pos_str[0] !== "\n") {
                    msg += "\n" + pos_str;
                  } else {
                    msg += pos_str;
                  }
                }
              }
            }
            var pei = {
              errStr: msg,
              recoverable: !!recoverable,
              text: this.match,
              // This one MAY be empty; userland code should use the `upcomingInput` API to obtain more text which follows the 'lexer cursor position'...  
              token: null,
              line: this.yylineno,
              loc: this.yylloc,
              yy: this.yy,
              lexer: this,
              /**
               * and make sure the error info doesn't stay due to potential
               * ref cycle via userland code manipulations.
               * These would otherwise all be memory leak opportunities!
               * 
               * Note that only array and object references are nuked as those
               * constitute the set of elements which can produce a cyclic ref.
               * The rest of the members is kept intact as they are harmless.
               * 
               * @public
               * @this {LexErrorInfo}
               */
              destroy: function destructLexErrorInfo() {
                var rec = !!this.recoverable;
                for (var key in this) {
                  if (this.hasOwnProperty(key) && typeof key === "object") {
                    this[key] = void 0;
                  }
                }
                this.recoverable = rec;
              }
            };
            this.__error_infos.push(pei);
            return pei;
          },
          /**
           * handler which is invoked when a lexer error occurs.
           * 
           * @public
           * @this {RegExpLexer}
           */
          parseError: function lexer_parseError(str, hash, ExceptionClass) {
            if (!ExceptionClass) {
              ExceptionClass = this.JisonLexerError;
            }
            if (this.yy) {
              if (this.yy.parser && typeof this.yy.parser.parseError === "function") {
                return this.yy.parser.parseError.call(this, str, hash, ExceptionClass) || this.ERROR;
              } else if (typeof this.yy.parseError === "function") {
                return this.yy.parseError.call(this, str, hash, ExceptionClass) || this.ERROR;
              }
            }
            throw new ExceptionClass(str, hash);
          },
          /**
           * method which implements `yyerror(str, ...args)` functionality for use inside lexer actions.
           * 
           * @public
           * @this {RegExpLexer}
           */
          yyerror: function yyError(str) {
            var lineno_msg = "";
            if (this.yylloc) {
              lineno_msg = " on line " + (this.yylineno + 1);
            }
            var p = this.constructLexErrorInfo(
              "Lexical error" + lineno_msg + ": " + str,
              this.options.lexerErrorsAreRecoverable
            );
            var args = Array.prototype.slice.call(arguments, 1);
            if (args.length) {
              p.extra_error_attributes = args;
            }
            return this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR;
          },
          /**
           * final cleanup function for when we have completed lexing the input;
           * make it an API so that external code can use this one once userland
           * code has decided it's time to destroy any lingering lexer error
           * hash object instances and the like: this function helps to clean
           * up these constructs, which *may* carry cyclic references which would
           * otherwise prevent the instances from being properly and timely
           * garbage-collected, i.e. this function helps prevent memory leaks!
           * 
           * @public
           * @this {RegExpLexer}
           */
          cleanupAfterLex: function lexer_cleanupAfterLex(do_not_nuke_errorinfos) {
            this.setInput("", {});
            if (!do_not_nuke_errorinfos) {
              for (var i = this.__error_infos.length - 1; i >= 0; i--) {
                var el = this.__error_infos[i];
                if (el && typeof el.destroy === "function") {
                  el.destroy();
                }
              }
              this.__error_infos.length = 0;
            }
            return this;
          },
          /**
           * clear the lexer token context; intended for internal use only
           * 
           * @public
           * @this {RegExpLexer}
           */
          clear: function lexer_clear() {
            this.yytext = "";
            this.yyleng = 0;
            this.match = "";
            this.matches = false;
            this._more = false;
            this._backtrack = false;
            var col = this.yylloc ? this.yylloc.last_column : 0;
            this.yylloc = {
              first_line: this.yylineno + 1,
              first_column: col,
              last_line: this.yylineno + 1,
              last_column: col,
              range: [this.offset, this.offset]
            };
          },
          /**
           * resets the lexer, sets new input
           * 
           * @public
           * @this {RegExpLexer}
           */
          setInput: function lexer_setInput(input2, yy) {
            this.yy = yy || this.yy || {};
            if (!this.__decompressed) {
              var rules = this.rules;
              for (var i = 0, len = rules.length; i < len; i++) {
                var rule_re = rules[i];
                if (typeof rule_re === "number") {
                  rules[i] = rules[rule_re];
                }
              }
              var conditions = this.conditions;
              for (var k in conditions) {
                var spec = conditions[k];
                var rule_ids = spec.rules;
                var len = rule_ids.length;
                var rule_regexes = new Array(len + 1);
                var rule_new_ids = new Array(len + 1);
                for (var i = 0; i < len; i++) {
                  var idx = rule_ids[i];
                  var rule_re = rules[idx];
                  rule_regexes[i + 1] = rule_re;
                  rule_new_ids[i + 1] = idx;
                }
                spec.rules = rule_new_ids;
                spec.__rule_regexes = rule_regexes;
                spec.__rule_count = len;
              }
              this.__decompressed = true;
            }
            this._input = input2 || "";
            this.clear();
            this._signaled_error_token = false;
            this.done = false;
            this.yylineno = 0;
            this.matched = "";
            this.conditionStack = ["INITIAL"];
            this.__currentRuleSet__ = null;
            this.yylloc = {
              first_line: 1,
              first_column: 0,
              last_line: 1,
              last_column: 0,
              range: [0, 0]
            };
            this.offset = 0;
            return this;
          },
          /**
           * edit the remaining input via user-specified callback.
           * This can be used to forward-adjust the input-to-parse, 
           * e.g. inserting macro expansions and alike in the
           * input which has yet to be lexed.
           * The behaviour of this API contrasts the `unput()` et al
           * APIs as those act on the *consumed* input, while this
           * one allows one to manipulate the future, without impacting
           * the current `yyloc` cursor location or any history. 
           * 
           * Use this API to help implement C-preprocessor-like
           * `#include` statements, etc.
           * 
           * The provided callback must be synchronous and is
           * expected to return the edited input (string).
           *
           * The `cpsArg` argument value is passed to the callback
           * as-is.
           *
           * `callback` interface: 
           * `function callback(input, cpsArg)`
           * 
           * - `input` will carry the remaining-input-to-lex string
           *   from the lexer.
           * - `cpsArg` is `cpsArg` passed into this API.
           * 
           * The `this` reference for the callback will be set to
           * reference this lexer instance so that userland code
           * in the callback can easily and quickly access any lexer
           * API. 
           *
           * When the callback returns a non-string-type falsey value,
           * we assume the callback did not edit the input and we
           * will using the input as-is.
           *
           * When the callback returns a non-string-type value, it
           * is converted to a string for lexing via the `"" + retval`
           * operation. (See also why: http://2ality.com/2012/03/converting-to-string.html 
           * -- that way any returned object's `toValue()` and `toString()`
           * methods will be invoked in a proper/desirable order.)
           * 
           * @public
           * @this {RegExpLexer}
           */
          editRemainingInput: function lexer_editRemainingInput(callback, cpsArg) {
            var rv = callback.call(this, this._input, cpsArg);
            if (typeof rv !== "string") {
              if (rv) {
                this._input = "" + rv;
              }
            } else {
              this._input = rv;
            }
            return this;
          },
          /**
           * consumes and returns one char from the input
           * 
           * @public
           * @this {RegExpLexer}
           */
          input: function lexer_input() {
            if (!this._input) {
              return null;
            }
            var ch = this._input[0];
            this.yytext += ch;
            this.yyleng++;
            this.offset++;
            this.match += ch;
            this.matched += ch;
            var slice_len = 1;
            var lines = false;
            if (ch === "\n") {
              lines = true;
            } else if (ch === "\r") {
              lines = true;
              var ch2 = this._input[1];
              if (ch2 === "\n") {
                slice_len++;
                ch += ch2;
                this.yytext += ch2;
                this.yyleng++;
                this.offset++;
                this.match += ch2;
                this.matched += ch2;
                this.yylloc.range[1]++;
              }
            }
            if (lines) {
              this.yylineno++;
              this.yylloc.last_line++;
              this.yylloc.last_column = 0;
            } else {
              this.yylloc.last_column++;
            }
            this.yylloc.range[1]++;
            this._input = this._input.slice(slice_len);
            return ch;
          },
          /**
           * unshifts one char (or an entire string) into the input
           * 
           * @public
           * @this {RegExpLexer}
           */
          unput: function lexer_unput(ch) {
            var len = ch.length;
            var lines = ch.split(/(?:\r\n?|\n)/g);
            this._input = ch + this._input;
            this.yytext = this.yytext.substr(0, this.yytext.length - len);
            this.yyleng = this.yytext.length;
            this.offset -= len;
            this.match = this.match.substr(0, this.match.length - len);
            this.matched = this.matched.substr(0, this.matched.length - len);
            if (lines.length > 1) {
              this.yylineno -= lines.length - 1;
              this.yylloc.last_line = this.yylineno + 1;
              var pre = this.match;
              var pre_lines = pre.split(/(?:\r\n?|\n)/g);
              if (pre_lines.length === 1) {
                pre = this.matched;
                pre_lines = pre.split(/(?:\r\n?|\n)/g);
              }
              this.yylloc.last_column = pre_lines[pre_lines.length - 1].length;
            } else {
              this.yylloc.last_column -= len;
            }
            this.yylloc.range[1] = this.yylloc.range[0] + this.yyleng;
            this.done = false;
            return this;
          },
          /**
           * cache matched text and append it on next action
           * 
           * @public
           * @this {RegExpLexer}
           */
          more: function lexer_more() {
            this._more = true;
            return this;
          },
          /**
           * signal the lexer that this rule fails to match the input, so the
           * next matching rule (regex) should be tested instead.
           * 
           * @public
           * @this {RegExpLexer}
           */
          reject: function lexer_reject() {
            if (this.options.backtrack_lexer) {
              this._backtrack = true;
            } else {
              var lineno_msg = "";
              if (this.yylloc) {
                lineno_msg = " on line " + (this.yylineno + 1);
              }
              var p = this.constructLexErrorInfo(
                "Lexical error" + lineno_msg + ": You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).",
                false
              );
              this._signaled_error_token = this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR;
            }
            return this;
          },
          /**
           * retain first n characters of the match
           * 
           * @public
           * @this {RegExpLexer}
           */
          less: function lexer_less(n) {
            return this.unput(this.match.slice(n));
          },
          /**
           * return (part of the) already matched input, i.e. for error
           * messages.
           * 
           * Limit the returned string length to `maxSize` (default: 20).
           * 
           * Limit the returned string to the `maxLines` number of lines of
           * input (default: 1).
           * 
           * Negative limit values equal *unlimited*.
           * 
           * @public
           * @this {RegExpLexer}
           */
          pastInput: function lexer_pastInput(maxSize, maxLines) {
            var past = this.matched.substring(0, this.matched.length - this.match.length);
            if (maxSize < 0)
              maxSize = past.length;
            else if (!maxSize)
              maxSize = 20;
            if (maxLines < 0)
              maxLines = past.length;
            else if (!maxLines)
              maxLines = 1;
            past = past.substr(-maxSize * 2 - 2);
            var a = past.replace(/\r\n|\r/g, "\n").split("\n");
            a = a.slice(-maxLines);
            past = a.join("\n");
            if (past.length > maxSize) {
              past = "..." + past.substr(-maxSize);
            }
            return past;
          },
          /**
           * return (part of the) upcoming input, i.e. for error messages.
           * 
           * Limit the returned string length to `maxSize` (default: 20).
           * 
           * Limit the returned string to the `maxLines` number of lines of input (default: 1).
           * 
           * Negative limit values equal *unlimited*.
           *
           * > ### NOTE ###
           * >
           * > *"upcoming input"* is defined as the whole of the both
           * > the *currently lexed* input, together with any remaining input
           * > following that. *"currently lexed"* input is the input 
           * > already recognized by the lexer but not yet returned with
           * > the lexer token. This happens when you are invoking this API
           * > from inside any lexer rule action code block. 
           * >
           * 
           * @public
           * @this {RegExpLexer}
           */
          upcomingInput: function lexer_upcomingInput(maxSize, maxLines) {
            var next = this.match;
            if (maxSize < 0)
              maxSize = next.length + this._input.length;
            else if (!maxSize)
              maxSize = 20;
            if (maxLines < 0)
              maxLines = maxSize;
            else if (!maxLines)
              maxLines = 1;
            if (next.length < maxSize * 2 + 2) {
              next += this._input.substring(0, maxSize * 2 + 2);
            }
            var a = next.replace(/\r\n|\r/g, "\n").split("\n");
            a = a.slice(0, maxLines);
            next = a.join("\n");
            if (next.length > maxSize) {
              next = next.substring(0, maxSize) + "...";
            }
            return next;
          },
          /**
           * return a string which displays the character position where the
           * lexing error occurred, i.e. for error messages
           * 
           * @public
           * @this {RegExpLexer}
           */
          showPosition: function lexer_showPosition(maxPrefix, maxPostfix) {
            var pre = this.pastInput(maxPrefix).replace(/\s/g, " ");
            var c2 = new Array(pre.length + 1).join("-");
            return pre + this.upcomingInput(maxPostfix).replace(/\s/g, " ") + "\n" + c2 + "^";
          },
          /**
           * return an YYLLOC info object derived off the given context (actual, preceding, following, current).
           * Use this method when the given `actual` location is not guaranteed to exist (i.e. when
           * it MAY be NULL) and you MUST have a valid location info object anyway:
           * then we take the given context of the `preceding` and `following` locations, IFF those are available,
           * and reconstruct the `actual` location info from those.
           * If this fails, the heuristic is to take the `current` location, IFF available.
           * If this fails as well, we assume the sought location is at/around the current lexer position
           * and then produce that one as a response. DO NOTE that these heuristic/derived location info
           * values MAY be inaccurate!
           *
           * NOTE: `deriveLocationInfo()` ALWAYS produces a location info object *copy* of `actual`, not just
           * a *reference* hence all input location objects can be assumed to be 'constant' (function has no side-effects).
           * 
           * @public
           * @this {RegExpLexer}
           */
          deriveLocationInfo: function lexer_deriveYYLLOC(actual, preceding, following, current) {
            var loc = {
              first_line: 1,
              first_column: 0,
              last_line: 1,
              last_column: 0,
              range: [0, 0]
            };
            if (actual) {
              loc.first_line = actual.first_line | 0;
              loc.last_line = actual.last_line | 0;
              loc.first_column = actual.first_column | 0;
              loc.last_column = actual.last_column | 0;
              if (actual.range) {
                loc.range[0] = actual.range[0] | 0;
                loc.range[1] = actual.range[1] | 0;
              }
            }
            if (loc.first_line <= 0 || loc.last_line < loc.first_line) {
              if (loc.first_line <= 0 && preceding) {
                loc.first_line = preceding.last_line | 0;
                loc.first_column = preceding.last_column | 0;
                if (preceding.range) {
                  loc.range[0] = actual.range[1] | 0;
                }
              }
              if ((loc.last_line <= 0 || loc.last_line < loc.first_line) && following) {
                loc.last_line = following.first_line | 0;
                loc.last_column = following.first_column | 0;
                if (following.range) {
                  loc.range[1] = actual.range[0] | 0;
                }
              }
              if (loc.first_line <= 0 && current && (loc.last_line <= 0 || current.last_line <= loc.last_line)) {
                loc.first_line = current.first_line | 0;
                loc.first_column = current.first_column | 0;
                if (current.range) {
                  loc.range[0] = current.range[0] | 0;
                }
              }
              if (loc.last_line <= 0 && current && (loc.first_line <= 0 || current.first_line >= loc.first_line)) {
                loc.last_line = current.last_line | 0;
                loc.last_column = current.last_column | 0;
                if (current.range) {
                  loc.range[1] = current.range[1] | 0;
                }
              }
            }
            if (loc.last_line <= 0) {
              if (loc.first_line <= 0) {
                loc.first_line = this.yylloc.first_line;
                loc.last_line = this.yylloc.last_line;
                loc.first_column = this.yylloc.first_column;
                loc.last_column = this.yylloc.last_column;
                loc.range[0] = this.yylloc.range[0];
                loc.range[1] = this.yylloc.range[1];
              } else {
                loc.last_line = this.yylloc.last_line;
                loc.last_column = this.yylloc.last_column;
                loc.range[1] = this.yylloc.range[1];
              }
            }
            if (loc.first_line <= 0) {
              loc.first_line = loc.last_line;
              loc.first_column = 0;
              loc.range[1] = loc.range[0];
            }
            if (loc.first_column < 0) {
              loc.first_column = 0;
            }
            if (loc.last_column < 0) {
              loc.last_column = loc.first_column > 0 ? loc.first_column : 80;
            }
            return loc;
          },
          /**
           * return a string which displays the lines & columns of input which are referenced 
           * by the given location info range, plus a few lines of context.
           * 
           * This function pretty-prints the indicated section of the input, with line numbers 
           * and everything!
           * 
           * This function is very useful to provide highly readable error reports, while
           * the location range may be specified in various flexible ways:
           * 
           * - `loc` is the location info object which references the area which should be
           *   displayed and 'marked up': these lines & columns of text are marked up by `^`
           *   characters below each character in the entire input range.
           * 
           * - `context_loc` is the *optional* location info object which instructs this
           *   pretty-printer how much *leading* context should be displayed alongside
           *   the area referenced by `loc`. This can help provide context for the displayed
           *   error, etc.
           * 
           *   When this location info is not provided, a default context of 3 lines is
           *   used.
           * 
           * - `context_loc2` is another *optional* location info object, which serves
           *   a similar purpose to `context_loc`: it specifies the amount of *trailing*
           *   context lines to display in the pretty-print output.
           * 
           *   When this location info is not provided, a default context of 1 line only is
           *   used.
           * 
           * Special Notes:
           * 
           * - when the `loc`-indicated range is very large (about 5 lines or more), then
           *   only the first and last few lines of this block are printed while a
           *   `...continued...` message will be printed between them.
           * 
           *   This serves the purpose of not printing a huge amount of text when the `loc`
           *   range happens to be huge: this way a manageable & readable output results
           *   for arbitrary large ranges.
           * 
           * - this function can display lines of input which whave not yet been lexed.
           *   `prettyPrintRange()` can access the entire input!
           * 
           * @public
           * @this {RegExpLexer}
           */
          prettyPrintRange: function lexer_prettyPrintRange(loc, context_loc, context_loc2) {
            loc = this.deriveLocationInfo(loc, context_loc, context_loc2);
            const CONTEXT = 3;
            const CONTEXT_TAIL = 1;
            const MINIMUM_VISIBLE_NONEMPTY_LINE_COUNT = 2;
            var input2 = this.matched + this._input;
            var lines = input2.split("\n");
            var l0 = Math.max(1, context_loc ? context_loc.first_line : loc.first_line - CONTEXT);
            var l1 = Math.max(1, context_loc2 ? context_loc2.last_line : loc.last_line + CONTEXT_TAIL);
            var lineno_display_width = 1 + Math.log10(l1 | 1) | 0;
            var ws_prefix = new Array(lineno_display_width).join(" ");
            var nonempty_line_indexes = [];
            var rv = lines.slice(l0 - 1, l1 + 1).map(function injectLineNumber(line, index) {
              var lno = index + l0;
              var lno_pfx = (ws_prefix + lno).substr(-lineno_display_width);
              var rv2 = lno_pfx + ": " + line;
              var errpfx = new Array(lineno_display_width + 1).join("^");
              var offset = 2 + 1;
              var len = 0;
              if (lno === loc.first_line) {
                offset += loc.first_column;
                len = Math.max(
                  2,
                  (lno === loc.last_line ? loc.last_column : line.length) - loc.first_column + 1
                );
              } else if (lno === loc.last_line) {
                len = Math.max(2, loc.last_column + 1);
              } else if (lno > loc.first_line && lno < loc.last_line) {
                len = Math.max(2, line.length + 1);
              }
              if (len) {
                var lead = new Array(offset).join(".");
                var mark = new Array(len).join("^");
                rv2 += "\n" + errpfx + lead + mark;
                if (line.trim().length > 0) {
                  nonempty_line_indexes.push(index);
                }
              }
              rv2 = rv2.replace(/\t/g, " ");
              return rv2;
            });
            if (nonempty_line_indexes.length > 2 * MINIMUM_VISIBLE_NONEMPTY_LINE_COUNT) {
              var clip_start = nonempty_line_indexes[MINIMUM_VISIBLE_NONEMPTY_LINE_COUNT - 1] + 1;
              var clip_end = nonempty_line_indexes[nonempty_line_indexes.length - MINIMUM_VISIBLE_NONEMPTY_LINE_COUNT] - 1;
              var intermediate_line = new Array(lineno_display_width + 1).join(" ") + "  (...continued...)";
              intermediate_line += "\n" + new Array(lineno_display_width + 1).join("-") + "  (---------------)";
              rv.splice(clip_start, clip_end - clip_start + 1, intermediate_line);
            }
            return rv.join("\n");
          },
          /**
           * helper function, used to produce a human readable description as a string, given
           * the input `yylloc` location object.
           * 
           * Set `display_range_too` to TRUE to include the string character index position(s)
           * in the description if the `yylloc.range` is available.
           * 
           * @public
           * @this {RegExpLexer}
           */
          describeYYLLOC: function lexer_describe_yylloc(yylloc, display_range_too) {
            var l1 = yylloc.first_line;
            var l2 = yylloc.last_line;
            var c1 = yylloc.first_column;
            var c2 = yylloc.last_column;
            var dl = l2 - l1;
            var dc = c2 - c1;
            var rv;
            if (dl === 0) {
              rv = "line " + l1 + ", ";
              if (dc <= 1) {
                rv += "column " + c1;
              } else {
                rv += "columns " + c1 + " .. " + c2;
              }
            } else {
              rv = "lines " + l1 + "(column " + c1 + ") .. " + l2 + "(column " + c2 + ")";
            }
            if (yylloc.range && display_range_too) {
              var r1 = yylloc.range[0];
              var r2 = yylloc.range[1] - 1;
              if (r2 <= r1) {
                rv += " {String Offset: " + r1 + "}";
              } else {
                rv += " {String Offset range: " + r1 + " .. " + r2 + "}";
              }
            }
            return rv;
          },
          /**
           * test the lexed token: return FALSE when not a match, otherwise return token.
           * 
           * `match` is supposed to be an array coming out of a regex match, i.e. `match[0]`
           * contains the actually matched text string.
           * 
           * Also move the input cursor forward and update the match collectors:
           * 
           * - `yytext`
           * - `yyleng`
           * - `match`
           * - `matches`
           * - `yylloc`
           * - `offset`
           * 
           * @public
           * @this {RegExpLexer}
           */
          test_match: function lexer_test_match(match, indexed_rule) {
            var token, lines, backup, match_str, match_str_len;
            if (this.options.backtrack_lexer) {
              backup = {
                yylineno: this.yylineno,
                yylloc: {
                  first_line: this.yylloc.first_line,
                  last_line: this.yylloc.last_line,
                  first_column: this.yylloc.first_column,
                  last_column: this.yylloc.last_column,
                  range: this.yylloc.range.slice(0)
                },
                yytext: this.yytext,
                match: this.match,
                matches: this.matches,
                matched: this.matched,
                yyleng: this.yyleng,
                offset: this.offset,
                _more: this._more,
                _input: this._input,
                //_signaled_error_token: this._signaled_error_token,
                yy: this.yy,
                conditionStack: this.conditionStack.slice(0),
                done: this.done
              };
            }
            match_str = match[0];
            match_str_len = match_str.length;
            lines = match_str.split(/(?:\r\n?|\n)/g);
            if (lines.length > 1) {
              this.yylineno += lines.length - 1;
              this.yylloc.last_line = this.yylineno + 1;
              this.yylloc.last_column = lines[lines.length - 1].length;
            } else {
              this.yylloc.last_column += match_str_len;
            }
            this.yytext += match_str;
            this.match += match_str;
            this.matched += match_str;
            this.matches = match;
            this.yyleng = this.yytext.length;
            this.yylloc.range[1] += match_str_len;
            this.offset += match_str_len;
            this._more = false;
            this._backtrack = false;
            this._input = this._input.slice(match_str_len);
            token = this.performAction.call(
              this,
              this.yy,
              indexed_rule,
              this.conditionStack[this.conditionStack.length - 1]
              /* = YY_START */
            );
            if (this.done && this._input) {
              this.done = false;
            }
            if (token) {
              return token;
            } else if (this._backtrack) {
              for (var k in backup) {
                this[k] = backup[k];
              }
              this.__currentRuleSet__ = null;
              return false;
            } else if (this._signaled_error_token) {
              token = this._signaled_error_token;
              this._signaled_error_token = false;
              return token;
            }
            return false;
          },
          /**
           * return next match in input
           * 
           * @public
           * @this {RegExpLexer}
           */
          next: function lexer_next() {
            if (this.done) {
              this.clear();
              return this.EOF;
            }
            if (!this._input) {
              this.done = true;
            }
            var token, match, tempMatch, index;
            if (!this._more) {
              this.clear();
            }
            var spec = this.__currentRuleSet__;
            if (!spec) {
              spec = this.__currentRuleSet__ = this._currentRules();
              if (!spec || !spec.rules) {
                var lineno_msg = "";
                if (this.options.trackPosition) {
                  lineno_msg = " on line " + (this.yylineno + 1);
                }
                var p = this.constructLexErrorInfo(
                  "Internal lexer engine error" + lineno_msg + ': The lex grammar programmer pushed a non-existing condition name "' + this.topState() + '"; this is a fatal error and should be reported to the application programmer team!',
                  false
                );
                return this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR;
              }
            }
            var rule_ids = spec.rules;
            var regexes = spec.__rule_regexes;
            var len = spec.__rule_count;
            for (var i = 1; i <= len; i++) {
              tempMatch = this._input.match(regexes[i]);
              if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                  token = this.test_match(tempMatch, rule_ids[i]);
                  if (token !== false) {
                    return token;
                  } else if (this._backtrack) {
                    match = void 0;
                    continue;
                  } else {
                    return false;
                  }
                } else if (!this.options.flex) {
                  break;
                }
              }
            }
            if (match) {
              token = this.test_match(match, rule_ids[index]);
              if (token !== false) {
                return token;
              }
              return false;
            }
            if (!this._input) {
              this.done = true;
              this.clear();
              return this.EOF;
            } else {
              var lineno_msg = "";
              if (this.options.trackPosition) {
                lineno_msg = " on line " + (this.yylineno + 1);
              }
              var p = this.constructLexErrorInfo(
                "Lexical error" + lineno_msg + ": Unrecognized text.",
                this.options.lexerErrorsAreRecoverable
              );
              var pendingInput = this._input;
              var activeCondition = this.topState();
              var conditionStackDepth = this.conditionStack.length;
              token = this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR;
              if (token === this.ERROR) {
                if (!this.matches && // and make sure the input has been modified/consumed ...
                pendingInput === this._input && // ...or the lexer state has been modified significantly enough
                // to merit a non-consuming error handling action right now.
                activeCondition === this.topState() && conditionStackDepth === this.conditionStack.length) {
                  this.input();
                }
              }
              return token;
            }
          },
          /**
           * return next match that has a token
           * 
           * @public
           * @this {RegExpLexer}
           */
          lex: function lexer_lex() {
            var r;
            if (typeof this.pre_lex === "function") {
              r = this.pre_lex.call(this, 0);
            }
            if (typeof this.options.pre_lex === "function") {
              r = this.options.pre_lex.call(this, r) || r;
            }
            if (this.yy && typeof this.yy.pre_lex === "function") {
              r = this.yy.pre_lex.call(this, r) || r;
            }
            while (!r) {
              r = this.next();
            }
            if (this.yy && typeof this.yy.post_lex === "function") {
              r = this.yy.post_lex.call(this, r) || r;
            }
            if (typeof this.options.post_lex === "function") {
              r = this.options.post_lex.call(this, r) || r;
            }
            if (typeof this.post_lex === "function") {
              r = this.post_lex.call(this, r) || r;
            }
            return r;
          },
          /**
           * return next match that has a token. Identical to the `lex()` API but does not invoke any of the 
           * `pre_lex()` nor any of the `post_lex()` callbacks.
           * 
           * @public
           * @this {RegExpLexer}
           */
          fastLex: function lexer_fastLex() {
            var r;
            while (!r) {
              r = this.next();
            }
            return r;
          },
          /**
           * return info about the lexer state that can help a parser or other lexer API user to use the
           * most efficient means available. This API is provided to aid run-time performance for larger
           * systems which employ this lexer.
           * 
           * @public
           * @this {RegExpLexer}
           */
          canIUse: function lexer_canIUse() {
            var rv = {
              fastLex: !(typeof this.pre_lex === "function" || typeof this.options.pre_lex === "function" || this.yy && typeof this.yy.pre_lex === "function" || this.yy && typeof this.yy.post_lex === "function" || typeof this.options.post_lex === "function" || typeof this.post_lex === "function") && typeof this.fastLex === "function"
            };
            return rv;
          },
          /**
           * backwards compatible alias for `pushState()`;
           * the latter is symmetrical with `popState()` and we advise to use
           * those APIs in any modern lexer code, rather than `begin()`.
           * 
           * @public
           * @this {RegExpLexer}
           */
          begin: function lexer_begin(condition) {
            return this.pushState(condition);
          },
          /**
           * activates a new lexer condition state (pushes the new lexer
           * condition state onto the condition stack)
           * 
           * @public
           * @this {RegExpLexer}
           */
          pushState: function lexer_pushState(condition) {
            this.conditionStack.push(condition);
            this.__currentRuleSet__ = null;
            return this;
          },
          /**
           * pop the previously active lexer condition state off the condition
           * stack
           * 
           * @public
           * @this {RegExpLexer}
           */
          popState: function lexer_popState() {
            var n = this.conditionStack.length - 1;
            if (n > 0) {
              this.__currentRuleSet__ = null;
              return this.conditionStack.pop();
            } else {
              return this.conditionStack[0];
            }
          },
          /**
           * return the currently active lexer condition state; when an index
           * argument is provided it produces the N-th previous condition state,
           * if available
           * 
           * @public
           * @this {RegExpLexer}
           */
          topState: function lexer_topState(n) {
            n = this.conditionStack.length - 1 - Math.abs(n || 0);
            if (n >= 0) {
              return this.conditionStack[n];
            } else {
              return "INITIAL";
            }
          },
          /**
           * (internal) determine the lexer rule set which is active for the
           * currently active lexer condition state
           * 
           * @public
           * @this {RegExpLexer}
           */
          _currentRules: function lexer__currentRules() {
            if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
              return this.conditions[this.conditionStack[this.conditionStack.length - 1]];
            } else {
              return this.conditions["INITIAL"];
            }
          },
          /**
           * return the number of states currently on the stack
           * 
           * @public
           * @this {RegExpLexer}
           */
          stateStackSize: function lexer_stateStackSize() {
            return this.conditionStack.length;
          },
          options: {
            trackPosition: true,
            caseInsensitive: true
          },
          JisonLexerError,
          performAction: function lexer__performAction(yy, yyrulenumber, YY_START) {
            switch (yyrulenumber) {
              case 0:
                break;
              default:
                return this.simpleCaseActionClusters[yyrulenumber];
            }
          },
          simpleCaseActionClusters: {
            /*! Conditions:: INITIAL */
            /*! Rule::       (-(webkit|moz)-)?calc\b */
            1: 3,
            /*! Conditions:: INITIAL */
            /*! Rule::       [a-z][a-z0-9-]*\s*\((?:(?:"(?:\\.|[^\"\\])*"|'(?:\\.|[^\'\\])*')|\([^)]*\)|[^\(\)]*)*\) */
            2: 10,
            /*! Conditions:: INITIAL */
            /*! Rule::       \* */
            3: 8,
            /*! Conditions:: INITIAL */
            /*! Rule::       \/ */
            4: 9,
            /*! Conditions:: INITIAL */
            /*! Rule::       \+ */
            5: 6,
            /*! Conditions:: INITIAL */
            /*! Rule::       - */
            6: 7,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)em\b */
            7: 17,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)ex\b */
            8: 18,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)ch\b */
            9: 19,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)rem\b */
            10: 20,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)vw\b */
            11: 25,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)svw\b */
            12: 26,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)lvw\b */
            13: 27,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)dvw\b */
            14: 28,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)vh\b */
            15: 21,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)svh\b */
            16: 22,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)lvh\b */
            17: 23,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)dvh\b */
            18: 24,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)vmin\b */
            19: 29,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)svmin\b */
            20: 30,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)lvmin\b */
            21: 31,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)dvmin\b */
            22: 32,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)vmax\b */
            23: 33,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)svmax\b */
            24: 34,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)lvmax\b */
            25: 35,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)dvmax\b */
            26: 36,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)vb\b */
            27: 37,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)svb\b */
            28: 38,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)lvb\b */
            29: 39,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)dvb\b */
            30: 40,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)vi\b */
            31: 41,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)svi\b */
            32: 42,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)lvi\b */
            33: 43,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)dvi\b */
            34: 44,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)cqw\b */
            35: 45,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)cqh\b */
            36: 46,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)cqi\b */
            37: 47,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)cqb\b */
            38: 48,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)cqmin\b */
            39: 49,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)cqmax\b */
            40: 50,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)lh\b */
            41: 51,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)rlh\b */
            42: 52,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)cm\b */
            43: 11,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)mm\b */
            44: 11,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)Q\b */
            45: 11,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)in\b */
            46: 11,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)pt\b */
            47: 11,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)pc\b */
            48: 11,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)px\b */
            49: 11,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)deg\b */
            50: 12,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)grad\b */
            51: 12,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)rad\b */
            52: 12,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)turn\b */
            53: 12,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)s\b */
            54: 13,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)ms\b */
            55: 13,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)Hz\b */
            56: 14,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)kHz\b */
            57: 14,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)dpi\b */
            58: 15,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)dpcm\b */
            59: 15,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)dppx\b */
            60: 15,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)% */
            61: 53,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)\b */
            62: 55,
            /*! Conditions:: INITIAL */
            /*! Rule::       (infinity|pi|e)\b */
            63: 54,
            /*! Conditions:: INITIAL */
            /*! Rule::       (([0-9]+(\.[0-9]+)?|\.[0-9]+)(e(\+|-)[0-9]+)?)-?([a-zA-Z_]|[\240-\377]|(\\[0-9a-fA-F]{1,6}(\r\n|[ \t\r\n\f])?|\\[^\r\n\f0-9a-fA-F]))([a-zA-Z0-9_-]|[\240-\377]|(\\[0-9a-fA-F]{1,6}(\r\n|[ \t\r\n\f])?|\\[^\r\n\f0-9a-fA-F]))*\b */
            64: 16,
            /*! Conditions:: INITIAL */
            /*! Rule::       \( */
            65: 4,
            /*! Conditions:: INITIAL */
            /*! Rule::       \) */
            66: 5,
            /*! Conditions:: INITIAL */
            /*! Rule::       $ */
            67: 1
          },
          rules: [
            /*  0: */
            /^(?:\s+)/i,
            /*  1: */
            /^(?:(-(webkit|moz)-)?calc\b)/i,
            /*  2: */
            /^(?:[a-z][\d\-a-z]*\s*\((?:(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\([^)]*\)|[^()]*)*\))/i,
            /*  3: */
            /^(?:\*)/i,
            /*  4: */
            /^(?:\/)/i,
            /*  5: */
            /^(?:\+)/i,
            /*  6: */
            /^(?:-)/i,
            /*  7: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)em\b)/i,
            /*  8: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)ex\b)/i,
            /*  9: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)ch\b)/i,
            /* 10: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)rem\b)/i,
            /* 11: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)vw\b)/i,
            /* 12: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)svw\b)/i,
            /* 13: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)lvw\b)/i,
            /* 14: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)dvw\b)/i,
            /* 15: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)vh\b)/i,
            /* 16: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)svh\b)/i,
            /* 17: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)lvh\b)/i,
            /* 18: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)dvh\b)/i,
            /* 19: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)vmin\b)/i,
            /* 20: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)svmin\b)/i,
            /* 21: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)lvmin\b)/i,
            /* 22: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)dvmin\b)/i,
            /* 23: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)vmax\b)/i,
            /* 24: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)svmax\b)/i,
            /* 25: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)lvmax\b)/i,
            /* 26: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)dvmax\b)/i,
            /* 27: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)vb\b)/i,
            /* 28: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)svb\b)/i,
            /* 29: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)lvb\b)/i,
            /* 30: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)dvb\b)/i,
            /* 31: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)vi\b)/i,
            /* 32: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)svi\b)/i,
            /* 33: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)lvi\b)/i,
            /* 34: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)dvi\b)/i,
            /* 35: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)cqw\b)/i,
            /* 36: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)cqh\b)/i,
            /* 37: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)cqi\b)/i,
            /* 38: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)cqb\b)/i,
            /* 39: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)cqmin\b)/i,
            /* 40: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)cqmax\b)/i,
            /* 41: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)lh\b)/i,
            /* 42: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)rlh\b)/i,
            /* 43: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)cm\b)/i,
            /* 44: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)mm\b)/i,
            /* 45: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)Q\b)/i,
            /* 46: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)in\b)/i,
            /* 47: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)pt\b)/i,
            /* 48: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)pc\b)/i,
            /* 49: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)px\b)/i,
            /* 50: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)deg\b)/i,
            /* 51: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)grad\b)/i,
            /* 52: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)rad\b)/i,
            /* 53: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)turn\b)/i,
            /* 54: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)s\b)/i,
            /* 55: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)ms\b)/i,
            /* 56: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)Hz\b)/i,
            /* 57: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)kHz\b)/i,
            /* 58: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)dpi\b)/i,
            /* 59: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)dpcm\b)/i,
            /* 60: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)dppx\b)/i,
            /* 61: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)%)/i,
            /* 62: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)\b)/i,
            /* 63: */
            /^(?:(infinity|pi|e)\b)/i,
            /* 64: */
            /^(?:((\d+(\.\d+)?|\.\d+)(e(\+|-)\d+)?)-?([^\W\d]|[ -ÿ]|(\\[\dA-Fa-f]{1,6}(\r\n|[\t\n\f\r ])?|\\[^\d\n\f\rA-Fa-f]))([\w\-]|[ -ÿ]|(\\[\dA-Fa-f]{1,6}(\r\n|[\t\n\f\r ])?|\\[^\d\n\f\rA-Fa-f]))*\b)/i,
            /* 65: */
            /^(?:\()/i,
            /* 66: */
            /^(?:\))/i,
            /* 67: */
            /^(?:$)/i
          ],
          conditions: {
            "INITIAL": {
              rules: [
                0,
                1,
                2,
                3,
                4,
                5,
                6,
                7,
                8,
                9,
                10,
                11,
                12,
                13,
                14,
                15,
                16,
                17,
                18,
                19,
                20,
                21,
                22,
                23,
                24,
                25,
                26,
                27,
                28,
                29,
                30,
                31,
                32,
                33,
                34,
                35,
                36,
                37,
                38,
                39,
                40,
                41,
                42,
                43,
                44,
                45,
                46,
                47,
                48,
                49,
                50,
                51,
                52,
                53,
                54,
                55,
                56,
                57,
                58,
                59,
                60,
                61,
                62,
                63,
                64,
                65,
                66,
                67
              ],
              inclusive: true
            }
          }
        };
        return lexer2;
      }();
      parser3.lexer = lexer;
      function Parser() {
        this.yy = {};
      }
      Parser.prototype = parser3;
      parser3.Parser = Parser;
      return new Parser();
    }();
    if (typeof commonjsRequire !== "undefined" && true) {
      exports.parser = parser2;
      exports.Parser = parser2.Parser;
      exports.parse = function() {
        return parser2.parse.apply(parser2, arguments);
      };
    }
  })(parser);
  return parser;
}
var convertUnit_1;
var hasRequiredConvertUnit;
function requireConvertUnit() {
  if (hasRequiredConvertUnit) return convertUnit_1;
  hasRequiredConvertUnit = 1;
  const conversions = {
    // Absolute length units
    px: {
      px: 1,
      cm: 96 / 2.54,
      mm: 96 / 25.4,
      q: 96 / 101.6,
      in: 96,
      pt: 96 / 72,
      pc: 16
    },
    cm: {
      px: 2.54 / 96,
      cm: 1,
      mm: 0.1,
      q: 0.025,
      in: 2.54,
      pt: 2.54 / 72,
      pc: 2.54 / 6
    },
    mm: {
      px: 25.4 / 96,
      cm: 10,
      mm: 1,
      q: 0.25,
      in: 25.4,
      pt: 25.4 / 72,
      pc: 25.4 / 6
    },
    q: {
      px: 101.6 / 96,
      cm: 40,
      mm: 4,
      q: 1,
      in: 101.6,
      pt: 101.6 / 72,
      pc: 101.6 / 6
    },
    in: {
      px: 1 / 96,
      cm: 1 / 2.54,
      mm: 1 / 25.4,
      q: 1 / 101.6,
      in: 1,
      pt: 1 / 72,
      pc: 1 / 6
    },
    pt: {
      px: 0.75,
      cm: 72 / 2.54,
      mm: 72 / 25.4,
      q: 72 / 101.6,
      in: 72,
      pt: 1,
      pc: 12
    },
    pc: {
      px: 0.0625,
      cm: 6 / 2.54,
      mm: 6 / 25.4,
      q: 6 / 101.6,
      in: 6,
      pt: 6 / 72,
      pc: 1
    },
    // Angle units
    deg: {
      deg: 1,
      grad: 0.9,
      rad: 180 / Math.PI,
      turn: 360
    },
    grad: {
      deg: 400 / 360,
      grad: 1,
      rad: 200 / Math.PI,
      turn: 400
    },
    rad: {
      deg: Math.PI / 180,
      grad: Math.PI / 200,
      rad: 1,
      turn: Math.PI * 2
    },
    turn: {
      deg: 1 / 360,
      grad: 25e-4,
      rad: 0.5 / Math.PI,
      turn: 1
    },
    // Duration units
    s: {
      s: 1,
      ms: 1e-3
    },
    ms: {
      s: 1e3,
      ms: 1
    },
    // Frequency units
    hz: {
      hz: 1,
      khz: 1e3
    },
    khz: {
      hz: 1e-3,
      khz: 1
    },
    // Resolution units
    dpi: {
      dpi: 1,
      dpcm: 1 / 2.54,
      dppx: 1 / 96
    },
    dpcm: {
      dpi: 2.54,
      dpcm: 1,
      dppx: 2.54 / 96
    },
    dppx: {
      dpi: 96,
      dpcm: 96 / 2.54,
      dppx: 1
    }
  };
  function convertUnit(value, sourceUnit, targetUnit, precision) {
    const sourceUnitNormalized = sourceUnit.toLowerCase();
    const targetUnitNormalized = targetUnit.toLowerCase();
    if (!conversions[targetUnitNormalized]) {
      throw new Error("Cannot convert to " + targetUnit);
    }
    if (!conversions[targetUnitNormalized][sourceUnitNormalized]) {
      throw new Error("Cannot convert from " + sourceUnit + " to " + targetUnit);
    }
    const converted = conversions[targetUnitNormalized][sourceUnitNormalized] * value;
    if (precision !== false) {
      precision = Math.pow(10, Math.ceil(precision) || 5);
      return Math.round(converted * precision) / precision;
    }
    return converted;
  }
  convertUnit_1 = convertUnit;
  return convertUnit_1;
}
var reducer;
var hasRequiredReducer;
function requireReducer() {
  if (hasRequiredReducer) return reducer;
  hasRequiredReducer = 1;
  const convertUnit = requireConvertUnit();
  function isValueType(node2) {
    switch (node2.type) {
      case "LengthValue":
      case "AngleValue":
      case "TimeValue":
      case "FrequencyValue":
      case "ResolutionValue":
      case "EmValue":
      case "ExValue":
      case "ChValue":
      case "RemValue":
      case "VhValue":
      case "SvhValue":
      case "LvhValue":
      case "DvhValue":
      case "VwValue":
      case "SvwValue":
      case "LvwValue":
      case "DvwValue":
      case "VminValue":
      case "SvminValue":
      case "LvminValue":
      case "DvminValue":
      case "VmaxValue":
      case "SvmaxValue":
      case "LvmaxValue":
      case "DvmaxValue":
      case "VbValue":
      case "SvbValue":
      case "LvbValue":
      case "DvbValue":
      case "ViValue":
      case "SviValue":
      case "LviValue":
      case "DviValue":
      case "CqwValue":
      case "CqhValue":
      case "CqiValue":
      case "CqbValue":
      case "CqminValue":
      case "CqmaxValue":
      case "PercentageValue":
      case "LhValue":
      case "RlhValue":
      case "Number":
        return true;
    }
    return false;
  }
  function flip(operator) {
    return operator === "+" ? "-" : "+";
  }
  function isAddSubOperator(operator) {
    return operator === "+" || operator === "-";
  }
  function collectAddSubItems(preOperator, node2, collected, precision) {
    if (!isAddSubOperator(preOperator)) {
      throw new Error(`invalid operator ${preOperator}`);
    }
    if (isValueType(node2)) {
      const itemIndex = collected.findIndex((x) => x.node.type === node2.type);
      if (itemIndex >= 0) {
        if (node2.value === 0) {
          return;
        }
        const otherValueNode = (
          /** @type import('../parser').ValueExpression*/
          collected[itemIndex].node
        );
        const { left: reducedNode, right: current } = convertNodesUnits(
          otherValueNode,
          node2,
          precision
        );
        if (collected[itemIndex].preOperator === "-") {
          collected[itemIndex].preOperator = "+";
          reducedNode.value *= -1;
        }
        if (preOperator === "+") {
          reducedNode.value += current.value;
        } else {
          reducedNode.value -= current.value;
        }
        if (reducedNode.value >= 0) {
          collected[itemIndex] = { node: reducedNode, preOperator: "+" };
        } else {
          reducedNode.value *= -1;
          collected[itemIndex] = { node: reducedNode, preOperator: "-" };
        }
      } else {
        if (node2.value >= 0) {
          collected.push({ node: node2, preOperator });
        } else {
          node2.value *= -1;
          collected.push({ node: node2, preOperator: flip(preOperator) });
        }
      }
    } else if (node2.type === "MathExpression") {
      if (isAddSubOperator(node2.operator)) {
        collectAddSubItems(preOperator, node2.left, collected, precision);
        const collectRightOperator = preOperator === "-" ? flip(node2.operator) : node2.operator;
        collectAddSubItems(
          collectRightOperator,
          node2.right,
          collected,
          precision
        );
      } else {
        const reducedNode = reduce(node2, precision);
        if (reducedNode.type !== "MathExpression" || isAddSubOperator(reducedNode.operator)) {
          collectAddSubItems(preOperator, reducedNode, collected, precision);
        } else {
          collected.push({ node: reducedNode, preOperator });
        }
      }
    } else if (node2.type === "ParenthesizedExpression") {
      collectAddSubItems(preOperator, node2.content, collected, precision);
    } else {
      collected.push({ node: node2, preOperator });
    }
  }
  function reduceAddSubExpression(node2, precision) {
    const collected = [];
    collectAddSubItems("+", node2, collected, precision);
    const withoutZeroItem = collected.filter(
      (item) => !(isValueType(item.node) && item.node.value === 0)
    );
    const firstNonZeroItem = withoutZeroItem[0];
    if (!firstNonZeroItem || firstNonZeroItem.preOperator === "-" && !isValueType(firstNonZeroItem.node)) {
      const firstZeroItem = collected.find(
        (item) => isValueType(item.node) && item.node.value === 0
      );
      if (firstZeroItem) {
        withoutZeroItem.unshift(firstZeroItem);
      }
    }
    if (withoutZeroItem[0].preOperator === "-" && isValueType(withoutZeroItem[0].node)) {
      withoutZeroItem[0].node.value *= -1;
      withoutZeroItem[0].preOperator = "+";
    }
    let root2 = withoutZeroItem[0].node;
    for (let i = 1; i < withoutZeroItem.length; i++) {
      root2 = {
        type: "MathExpression",
        operator: withoutZeroItem[i].preOperator,
        left: root2,
        right: withoutZeroItem[i].node
      };
    }
    return root2;
  }
  function reduceDivisionExpression(node2) {
    if (!isValueType(node2.right)) {
      return node2;
    }
    if (node2.right.type !== "Number") {
      throw new Error(`Cannot divide by "${node2.right.unit}", number expected`);
    }
    return applyNumberDivision(node2.left, node2.right.value);
  }
  function applyNumberDivision(node2, divisor) {
    if (divisor === 0) {
      throw new Error("Cannot divide by zero");
    }
    if (isValueType(node2)) {
      node2.value /= divisor;
      return node2;
    }
    if (node2.type === "MathExpression" && isAddSubOperator(node2.operator)) {
      return {
        type: "MathExpression",
        operator: node2.operator,
        left: applyNumberDivision(node2.left, divisor),
        right: applyNumberDivision(node2.right, divisor)
      };
    }
    return {
      type: "MathExpression",
      operator: "/",
      left: node2,
      right: {
        type: "Number",
        value: divisor
      }
    };
  }
  function reduceMultiplicationExpression(node2) {
    if (node2.right.type === "Number") {
      return applyNumberMultiplication(node2.left, node2.right.value);
    }
    if (node2.left.type === "Number") {
      return applyNumberMultiplication(node2.right, node2.left.value);
    }
    return node2;
  }
  function applyNumberMultiplication(node2, multiplier) {
    if (isValueType(node2)) {
      node2.value *= multiplier;
      return node2;
    }
    if (node2.type === "MathExpression" && isAddSubOperator(node2.operator)) {
      return {
        type: "MathExpression",
        operator: node2.operator,
        left: applyNumberMultiplication(node2.left, multiplier),
        right: applyNumberMultiplication(node2.right, multiplier)
      };
    }
    return {
      type: "MathExpression",
      operator: "*",
      left: node2,
      right: {
        type: "Number",
        value: multiplier
      }
    };
  }
  function convertNodesUnits(left, right, precision) {
    switch (left.type) {
      case "LengthValue":
      case "AngleValue":
      case "TimeValue":
      case "FrequencyValue":
      case "ResolutionValue":
        if (right.type === left.type && right.unit && left.unit) {
          const converted = convertUnit(
            right.value,
            right.unit,
            left.unit,
            precision
          );
          right = {
            type: left.type,
            value: converted,
            unit: left.unit
          };
        }
        return { left, right };
      default:
        return { left, right };
    }
  }
  function includesNoCssProperties(node2) {
    return node2.content.type !== "Function" && (node2.content.type !== "MathExpression" || node2.content.right.type !== "Function" && node2.content.left.type !== "Function");
  }
  function reduce(node2, precision) {
    if (node2.type === "MathExpression" && (node2.left.type === "CalcKeyword" || node2.right.type === "CalcKeyword")) {
      return node2;
    }
    if (node2.type === "MathExpression") {
      if (isAddSubOperator(node2.operator)) {
        return reduceAddSubExpression(node2, precision);
      }
      node2.left = reduce(node2.left, precision);
      node2.right = reduce(node2.right, precision);
      switch (node2.operator) {
        case "/":
          return reduceDivisionExpression(node2);
        case "*":
          return reduceMultiplicationExpression(node2);
      }
      return node2;
    }
    if (node2.type === "ParenthesizedExpression") {
      if (includesNoCssProperties(node2)) {
        return reduce(node2.content, precision);
      }
    }
    return node2;
  }
  reducer = reduce;
  return reducer;
}
var stringifier;
var hasRequiredStringifier;
function requireStringifier() {
  if (hasRequiredStringifier) return stringifier;
  hasRequiredStringifier = 1;
  const order = {
    "*": 0,
    "/": 0,
    "+": 1,
    "-": 1
  };
  function round(value, prec) {
    if (prec !== false) {
      const precision = Math.pow(10, prec);
      return Math.round(value * precision) / precision;
    }
    return value;
  }
  function stringify(node2, prec) {
    switch (node2.type) {
      case "MathExpression": {
        const { left, right, operator: op } = node2;
        let str = "";
        if (left.type === "MathExpression" && order[op] < order[left.operator]) {
          str += `(${stringify(left, prec)})`;
        } else if (left.type === "CalcKeyword") {
          str += left.value;
        } else {
          str += stringify(left, prec);
        }
        str += order[op] ? ` ${node2.operator} ` : node2.operator;
        if (right.type === "MathExpression" && order[op] < order[right.operator]) {
          str += `(${stringify(right, prec)})`;
        } else if (right.type === "CalcKeyword") {
          str += right.value;
        } else {
          str += stringify(right, prec);
        }
        return str;
      }
      case "Number":
        return round(node2.value, prec).toString();
      case "Function":
        return node2.value.toString();
      case "ParenthesizedExpression":
        return `(${stringify(node2.content, prec)})`;
      case "CalcKeyword":
        return node2.value;
      default:
        return round(node2.value, prec) + node2.unit;
    }
  }
  stringifier = function(calc, node2, originalValue, options, result2, item) {
    let str = stringify(node2, options.precision);
    const shouldPrintCalc = node2.type === "MathExpression" || node2.type === "Function" || node2.type === "ParenthesizedExpression" || node2.type === "CalcKeyword";
    if (shouldPrintCalc) {
      if (node2.type === "ParenthesizedExpression") {
        str = `${calc}${str}`;
      } else {
        str = `${calc}(${str})`;
      }
      if (options.warnWhenCannotResolve) {
        result2.warn("Could not reduce expression: " + originalValue, {
          plugin: "postcss-calc",
          node: item
        });
      }
    }
    return str;
  };
  return stringifier;
}
var transform;
var hasRequiredTransform;
function requireTransform() {
  if (hasRequiredTransform) return transform;
  hasRequiredTransform = 1;
  const selectorParser = requireDist();
  const valueParser = requireLib();
  const { parser: parser2 } = requireParser();
  const reducer2 = requireReducer();
  const stringifier2 = requireStringifier();
  const MATCH_CALC = /((?:-(moz|webkit)-)?calc(?!-))/i;
  function transformValue(value, options, result2, item) {
    return valueParser(value).walk((node2) => {
      if (node2.type !== "function" || !MATCH_CALC.test(node2.value)) {
        return;
      }
      const contents = valueParser.stringify(node2.nodes);
      const ast = parser2.parse(contents);
      const reducedAst = reducer2(ast, options.precision);
      node2.type = "word";
      node2.value = stringifier2(
        node2.value,
        reducedAst,
        value,
        options,
        result2,
        item
      );
      return false;
    }).toString();
  }
  function transformSelector(value, options, result2, item) {
    return selectorParser((selectors2) => {
      selectors2.walk((node2) => {
        if (node2.type === "attribute" && node2.value) {
          node2.setValue(transformValue(node2.value, options, result2, item));
        }
        if (node2.type === "tag") {
          node2.value = transformValue(node2.value, options, result2, item);
        }
        return;
      });
    }).processSync(value);
  }
  transform = (node2, property, options, result2) => {
    let value = node2[property];
    try {
      value = property === "selector" ? transformSelector(node2[property], options, result2, node2) : transformValue(node2[property], options, result2, node2);
    } catch (error) {
      if (error instanceof Error) {
        result2.warn(error.message, { node: node2 });
      } else {
        result2.warn("Error", { node: node2 });
      }
      return;
    }
    if (options.preserve && node2[property] !== value) {
      const clone = node2.clone();
      clone[property] = value;
      node2.parent.insertBefore(node2, clone);
    } else {
      node2[property] = value;
    }
  };
  return transform;
}
var src;
var hasRequiredSrc;
function requireSrc() {
  if (hasRequiredSrc) return src;
  hasRequiredSrc = 1;
  const transform2 = requireTransform();
  function pluginCreator(opts) {
    const options = Object.assign(
      {
        precision: 5,
        preserve: false,
        warnWhenCannotResolve: false,
        mediaQueries: false,
        selectors: false
      },
      opts
    );
    return {
      postcssPlugin: "postcss-calc",
      OnceExit(css, { result: result2 }) {
        css.walk((node2) => {
          const { type } = node2;
          if (type === "decl") {
            transform2(node2, "value", options, result2);
          }
          if (type === "atrule" && options.mediaQueries) {
            transform2(node2, "params", options, result2);
          }
          if (type === "rule" && options.selectors) {
            transform2(node2, "selector", options, result2);
          }
        });
      }
    };
  }
  pluginCreator.postcss = true;
  src = pluginCreator;
  return src;
}
requireSrc();
var distExports = requireDist();
const e = /* @__PURE__ */ getDefaultExportFromCjs(distExports);
e.pseudo({ value: ":is" });
e();
await configure(await /* @__PURE__ */ logtapeConfiguration());
const l = getLogger(["a", "ui"]);
l.info`ui ready`;
parent.postMessage({ pluginMessage: "ui ready" }, "*");
onmessage = (event) => {
  l.info`got this from plugin ${event.data.pluginMessage}`;
};
