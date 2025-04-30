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
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
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
const util = {};
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
  ) : util != null && "inspect" in util && typeof util.inspect === "function" ? (v, opts) => (
    // @ts-ignore: Node.js global
    // dnt-shim-ignore
    util.inspect(v, {
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
  } catch (e) {
    if (e instanceof ConfigError) await reset();
    throw e;
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
console.log(
  "Neither running in a browser nor running in node, falling back to console logging only. App debug messages and module info messages would be logged to console in this mode."
);
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
await configure(await /* @__PURE__ */ logtapeConfiguration());
const l = getLogger(["a", "ui"]);
l.info`ui ready`;
parent.postMessage({ pluginMessage: "ui ready" }, "*");
onmessage = (event) => {
  console.log("got this from plugin", event.data.pluginMessage);
};
document.getElementById("test").textContent = "tested";
