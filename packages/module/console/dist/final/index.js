var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:!0});var D=typeof import.meta>"u"||typeof import.meta.env>"u"||typeof import.meta.env.MODE>"u"?typeof process>"u"||typeof process.env>"u"||typeof process.env.NODE_ENV>"u"?!1:process.env.NODE_ENV==="development":import.meta.env.MODE==="development",isDirSpecial=typeof process>"u"||typeof process.release>"u"||typeof process.release.name>"u"?!1:process.release.name==="node"||process.release.name==="deno",_dir=__name((...args)=>{isDirSpecial?args.forEach(arg=>{console.dir(arg,{depth:null})}):args.forEach(arg=>{console.dir(arg)})},"_dir"),assert=__name((assertion,...objs)=>(assertion||(console.log("ASSERT:"),console.trace(),_dir(objs)),assertion),"assert");function debug(arg1,...arg2plus){return D&&(console.debug("DEBUG:"),console.trace(),_dir(arg1,...arg2plus)),arguments.length===1?arg1:arg2plus}__name(debug,"debug");function info(arg1,...arg2plus){return D&&(console.info("INFO:"),console.trace(),_dir(arg1,...arg2plus)),arg2plus.length===0?arg1:[arg1,...arg2plus]}__name(info,"info");function warn(arg1,...arg2plus){return console.warn("WARN:"),console.trace(),_dir(arg1,...arg2plus),arg2plus.length===0?arg1:[arg1,...arg2plus]}__name(warn,"warn");function error(arg1,...arg2plus){return console.error("ERROR:"),process.exitCode===0&&(process.exitCode=1),console.trace(),_dir(arg1,...arg2plus),arg2plus.length===0?arg1:[arg1,...arg2plus]}__name(error,"error");function log(arg1,...arg2plus){return console.log("LOG:"),console.trace(),_dir(arg1,...arg2plus),arg2plus.length===0?arg1:[arg1,...arg2plus]}__name(log,"log");var src_default=Object.freeze({assert,debug,info,warn,error,log});export{src_default as default};
//# sourceMappingURL=index.js.map