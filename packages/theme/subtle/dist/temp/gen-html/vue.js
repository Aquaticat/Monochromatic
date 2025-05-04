var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:!0});import{createSSRApp}from"vue";import{renderToString}from"vue/server-renderer";import{fs,path}from"@monochromatic-dev/module-fs-path";async function mapParallelAsyncFn(fn,arr){let promised=arr.map((a,i)=>fn(a,i));return Promise.all(promised)}__name(mapParallelAsyncFn,"mapParallelAsyncFn");function mapParallelAsync(fn,arr){return arguments.length===1?async holder=>mapParallelAsyncFn(fn,holder):new Promise((resolve,reject)=>{mapParallelAsyncFn(fn,arr).then(resolve).catch(reject)})}__name(mapParallelAsync,"mapParallelAsync");function includesWith(predicate,target,list){let willReturn=!1,index=-1;for(;++index<list.length&&!willReturn;){let value=list[index];predicate(target,value)&&(willReturn=!0)}return willReturn}__name(includesWith,"includesWith");function uniqWith(predicate,list){if(arguments.length===1)return _list=>uniqWith(predicate,_list);let index=-1,willReturn=[];for(;++index<list.length;){let value=list[index];includesWith(predicate,value,willReturn)||willReturn.push(value)}return willReturn}__name(uniqWith,"uniqWith");import{defineComponent as _defineComponent13}from"vue";import{createVNode as _createVNode5,renderSlot as _renderSlot4,withCtx as _withCtx3,Fragment as _Fragment7,openBlock as _openBlock13,createElementBlock as _createElementBlock13}from"vue";import{defineComponent as _defineComponent3}from"vue";import{unref as _unref3,toDisplayString as _toDisplayString3,createElementVNode as _createElementVNode3,createVNode as _createVNode,openBlock as _openBlock3,createElementBlock as _createElementBlock3}from"vue";import{defineComponent as _defineComponent}from"vue";import{unref as _unref,toDisplayString as _toDisplayString,createElementVNode as _createElementVNode,createTextVNode as _createTextVNode,openBlock as _openBlock,createElementBlock as _createElementBlock}from"vue";import{inject}from"vue";var _hoisted_1={class:"existence-period"},_hoisted_2=["datetime"],_hoisted_3=["datetime"],ExistencePeriod_default=_defineComponent({__name:"ExistencePeriod",setup(__props){let fm=inject("frontmatter"),earliestYear=fm.earliest.getFullYear(),latestYear=fm.latest.getFullYear();return(_ctx,_cache)=>(_openBlock(),_createElementBlock("span",_hoisted_1,[_createElementVNode("time",{datetime:String(_unref(earliestYear))},_toDisplayString(_unref(earliestYear)),9,_hoisted_2),_createTextVNode(" - "),_createElementVNode("time",{datetime:String(_unref(latestYear))},_toDisplayString(_unref(latestYear)),9,_hoisted_3)]))}});import{defineComponent as _defineComponent2}from"vue";import{unref as _unref2,renderList as _renderList,Fragment as _Fragment,openBlock as _openBlock2,createElementBlock as _createElementBlock2,toDisplayString as _toDisplayString2,createElementVNode as _createElementVNode2}from"vue";import{inject as inject2}from"vue";var _hoisted_12={class:"Socials"},_hoisted_22=["href"],Socials_default=_defineComponent2({__name:"Socials",setup(__props){let fm=inject2("frontmatter");return(_ctx,_cache)=>(_openBlock2(),_createElementBlock2("ul",_hoisted_12,[(_openBlock2(!0),_createElementBlock2(_Fragment,null,_renderList(_unref2(fm).socials,([name,url])=>(_openBlock2(),_createElementBlock2("li",null,[_createElementVNode2("a",{href:url},[_createElementVNode2("span",null,_toDisplayString2(name),1)],8,_hoisted_22)]))),256))]))}});import{inject as inject3}from"vue";var _hoisted_13=["href"],_hoisted_23=_createElementVNode3("span",null,"by",-1),_hoisted_32=["href"],_hoisted_4=_createElementVNode3("small",null,[_createElementVNode3("span",null,[_createElementVNode3("a",{href:"https://monochromatic.dev/subtle"},[_createElementVNode3("span",null,"Subtle")]),_createElementVNode3("span",null,"@"),_createElementVNode3("a",{href:"https://vuejs.org"},[_createElementVNode3("span",null,"Vue JS")])]),_createElementVNode3("span",null,[_createElementVNode3("span",null,"by"),_createElementVNode3("a",{href:"https://aquati.cat"},[_createElementVNode3("span",null,"Aquaticat")])])],-1),Footer_default=_defineComponent3({__name:"Footer",setup(__props){let fm=inject3("frontmatter");return(_ctx,_cache)=>(_openBlock3(),_createElementBlock3("footer",null,[_createElementVNode3("div",null,[_createElementVNode3("small",null,[_createElementVNode3("span",null,[_createElementVNode3("a",{href:_unref3(fm).license.url},[_createElementVNode3("span",null,_toDisplayString3(_unref3(fm).license.name),1)],8,_hoisted_13),_createVNode(ExistencePeriod_default)]),_createElementVNode3("span",null,[_hoisted_23,_createElementVNode3("a",{href:_unref3(fm).author.url},[_createElementVNode3("span",null,_toDisplayString3(_unref3(fm).author.name),1)],8,_hoisted_32)])]),_createVNode(Socials_default),_hoisted_4])]))}});import{defineComponent as _defineComponent8}from"vue";import{unref as _unref6,createElementVNode as _createElementVNode6,openBlock as _openBlock8,createElementBlock as _createElementBlock8,renderList as _renderList4,Fragment as _Fragment4,toDisplayString as _toDisplayString7,createVNode as _createVNode3}from"vue";import{defineComponent as _defineComponent7}from"vue";import{renderList as _renderList3,Fragment as _Fragment3,openBlock as _openBlock7,createElementBlock as _createElementBlock7,createBlock as _createBlock,unref as _unref5,toDisplayString as _toDisplayString6,createTextVNode as _createTextVNode3,withCtx as _withCtx}from"vue";import{defineComponent as _defineComponent4}from"vue";import{renderSlot as _renderSlot,createElementVNode as _createElementVNode4,openBlock as _openBlock4,createElementBlock as _createElementBlock4}from"vue";var _hoisted_14={class:"Error"},_hoisted_24=_createElementVNode4("p",null,"Error without slot content",-1),Error_default=_defineComponent4({__name:"Error",setup(__props){return(_ctx,_cache)=>(_openBlock4(),_createElementBlock4("div",_hoisted_14,[_renderSlot(_ctx.$slots,"default",{},()=>[_hoisted_24])]))}});import{defineComponent as _defineComponent6}from"vue";import{toDisplayString as _toDisplayString5,createElementVNode as _createElementVNode5,renderList as _renderList2,Fragment as _Fragment2,openBlock as _openBlock6,createElementBlock as _createElementBlock6,unref as _unref4,createVNode as _createVNode2,createTextVNode as _createTextVNode2}from"vue";import{inject as inject4}from"vue";import{defineComponent as _defineComponent5}from"vue";import{toDisplayString as _toDisplayString4,openBlock as _openBlock5,createElementBlock as _createElementBlock5}from"vue";var _hoisted_15=["datetime"],PrettyDate_default=_defineComponent5({__name:"PrettyDate",props:{date:{type:Date,required:!0}},setup(__props){return(_ctx,_cache)=>(_openBlock5(),_createElementBlock5("time",{datetime:String(_ctx.date)},_toDisplayString4(_ctx.date.toLocaleDateString(void 0,{year:"numeric",month:"short",day:"2-digit"})),9,_hoisted_15))}});var _hoisted_16={class:"Post a"},_hoisted_25=["href"],_hoisted_33={class:"Post__content"},_hoisted_42={class:"Post__description"},_hoisted_5={class:"Post__summary"},_hoisted_6={class:"Post__tags"},_hoisted_7={class:"Post__tag"},_hoisted_8=["href"],_hoisted_9={class:"date"},Post_default=_defineComponent6({__name:"Post",props:{post:{type:Object,required:!0}},setup(__props){let fm=inject4("frontmatter");return(_ctx,_cache)=>(_openBlock6(),_createElementBlock6("li",_hoisted_16,[_createElementVNode5("a",{class:"overlay",href:`/${_ctx.post.slug}`},_toDisplayString5(_ctx.post.title),9,_hoisted_25),_createElementVNode5("div",_hoisted_33,[_createElementVNode5("h2",null,_toDisplayString5(_ctx.post.title),1),_createElementVNode5("p",_hoisted_42,_toDisplayString5(_ctx.post.description),1),_createElementVNode5("p",_hoisted_5,_toDisplayString5(_ctx.post.summary),1),_createElementVNode5("aside",null,[_createElementVNode5("ul",_hoisted_6,[(_openBlock6(!0),_createElementBlock6(_Fragment2,null,_renderList2(_ctx.post.tags,tag=>(_openBlock6(),_createElementBlock6("li",_hoisted_7,[_createElementVNode5("a",{href:`${_unref4(fm).slashSiteBaseWLang}/tags/${tag}`},[_createElementVNode5("span",null,_toDisplayString5(tag),1)],8,_hoisted_8)]))),256))]),_createElementVNode5("span",_hoisted_9,[_createVNode2(PrettyDate_default,{date:_ctx.post.published.at(0).date},null,8,["date"]),_createTextVNode2(" - "),_createVNode2(PrettyDate_default,{date:_ctx.post.updated.at(-1).date},null,8,["date"])])])])]))}});import{inject as inject5}from"vue";var _hoisted_17={class:"Posts"},Posts_default=_defineComponent7({__name:"Posts",props:{posts:{type:Array,required:!1}},setup(__props){let fms2=inject5("frontmatters"),fm=inject5("frontmatter"),fmsMatchedLang=fms2.filter(potentialFmMatchedLang=>potentialFmMatchedLang.lang===fm.lang&&!potentialFmMatchedLang.is404&&potentialFmMatchedLang.isPost);return(_ctx,_cache)=>(_openBlock7(),_createElementBlock7("ul",_hoisted_17,[_ctx.posts?(_openBlock7(!0),_createElementBlock7(_Fragment3,{key:0},_renderList3(_ctx.posts,post=>(_openBlock7(),_createBlock(Post_default,{post},null,8,["post"]))),256)):_unref5(fmsMatchedLang)?(_openBlock7(!0),_createElementBlock7(_Fragment3,{key:1},_renderList3(_unref5(fmsMatchedLang),post=>(_openBlock7(),_createBlock(Post_default,{post},null,8,["post"]))),256)):(_openBlock7(),_createBlock(Error_default,{key:2},{default:_withCtx(()=>[_createTextVNode3("Could not load either "+_toDisplayString6(_ctx.posts)+" from props or "+_toDisplayString6(_unref5(fms2))+" from inject",1)]),_:1}))]))}});import{inject as inject6}from"vue";var _hoisted_18=["href"],_hoisted_26=["src"],_hoisted_34=_createElementVNode6("button",{popovertarget:"search"},[_createElementVNode6("svg",{width:"20",height:"20",viewBox:"0 0 20 20",fill:"none",xmlns:"http://www.w3.org/2000/svg"},[_createElementVNode6("path",{d:"M18.7441 19.0893L14.03 14.3752M16.8333 9.33333C16.8333 13.0152 13.8486 16 10.1667 16C6.48477 16 3.5 13.0152 3.5 9.33333C3.5 5.65143 6.48477 2.66666 10.1667 2.66666C13.8486 2.66666 16.8333 5.65143 16.8333 9.33333Z",stroke:"currentColor","stroke-width":"2.5"})])],-1),_hoisted_43={popover:"",id:"search"},_hoisted_52={method:"get"},_hoisted_62=["placeholder"],_hoisted_72={class:"Header__tags"},_hoisted_82=["href"],Header_default=_defineComponent8({__name:"Header",setup(__props){let fm=inject6("frontmatter"),fms2=inject6("frontmatters"),uniqueTags=new Set(fms2.flatMap(fm2=>fm2.tags)),tagPost=new Map(Array.from(uniqueTags).map(tag=>[tag,fms2.filter(fm2=>!fm2.is404&&fm2.isPost&&fm2.tags.includes(tag))])),searchPlaceholder=new Map([["en","Search keyword, topic, or text"],["zh","搜索关键词，话题，或文段"]]);return(_ctx,_cache)=>(_openBlock8(),_createElementBlock8("header",null,[_createElementVNode6("div",null,[_createElementVNode6("a",{href:_unref6(fm).slashSiteBaseWLang},[_createElementVNode6("img",{src:`${_unref6(fm).slashSiteBase}/favicon.svg`,alt:"avatar"},null,8,_hoisted_26)],8,_hoisted_18),_createElementVNode6("nav",null,[_hoisted_34,_createElementVNode6("div",_hoisted_43,[_createElementVNode6("form",_hoisted_52,[_createElementVNode6("input",{name:"q",type:"search",required:"",placeholder:_unref6(searchPlaceholder).get(_unref6(fm).lang)||_unref6(searchPlaceholder).get(_unref6(fm).lang.slice(0,2))||_unref6(searchPlaceholder).get(_unref6(fm).defaultLang)||_unref6(searchPlaceholder).get(_unref6(fm).defaultLang.slice(0,2))},null,8,_hoisted_62)]),_createElementVNode6("ul",_hoisted_72,[(_openBlock8(!0),_createElementBlock8(_Fragment4,null,_renderList4(_unref6(tagPost),([tag,posts2])=>(_openBlock8(),_createElementBlock8("li",null,[_createElementVNode6("details",null,[_createElementVNode6("summary",null,[_createElementVNode6("span",null,_toDisplayString7(tag),1)]),_createVNode3(Posts_default,{posts:posts2},null,8,["posts"])])]))),256))])]),_createElementVNode6("a",{href:`${_unref6(fm).slashSiteBaseWLang}/links`},[_createElementVNode6("span",null,_toDisplayString7(_unref6(fms2).find(potentialLinks=>potentialLinks.isLinks&&potentialLinks.lang===_unref6(fm).lang)?.title||_unref6(fms2).find(potentialLinks=>potentialLinks.isLinks&&potentialLinks.lang===_unref6(fm).defaultLang).title),1)],8,_hoisted_82)])])]))}});import{defineComponent as _defineComponent12}from"vue";import{renderSlot as _renderSlot3,unref as _unref10,renderList as _renderList6,Fragment as _Fragment6,openBlock as _openBlock12,createElementBlock as _createElementBlock12,toDisplayString as _toDisplayString10,createElementVNode as _createElementVNode9,withCtx as _withCtx2,createVNode as _createVNode4}from"vue";import{defineComponent as _defineComponent9}from"vue";import{unref as _unref7,toDisplayString as _toDisplayString8,createElementVNode as _createElementVNode7,renderSlot as _renderSlot2,openBlock as _openBlock9,createElementBlock as _createElementBlock9}from"vue";import{inject as inject7}from"vue";var _hoisted_19={class:"Article"},Article_default=_defineComponent9({__name:"Article",setup(__props){let fm=inject7("frontmatter");return(_ctx,_cache)=>(_openBlock9(),_createElementBlock9("article",_hoisted_19,[_createElementVNode7("h1",null,_toDisplayString8(_unref7(fm).title),1),_renderSlot2(_ctx.$slots,"default")]))}});import{defineComponent as _defineComponent11}from"vue";import{unref as _unref9,openBlock as _openBlock11,createBlock as _createBlock2,createElementBlock as _createElementBlock11}from"vue";import{defineComponent as _defineComponent10}from"vue";import{unref as _unref8,renderList as _renderList5,Fragment as _Fragment5,openBlock as _openBlock10,createElementBlock as _createElementBlock10,toDisplayString as _toDisplayString9,createElementVNode as _createElementVNode8}from"vue";import{inject as inject8}from"vue";var _hoisted_110={class:"Links"},_hoisted_27=["href"],Links_default=_defineComponent10({__name:"Links",setup(__props){let fm=inject8("frontmatter");return(_ctx,_cache)=>(_openBlock10(),_createElementBlock10("ul",_hoisted_110,[(_openBlock10(!0),_createElementBlock10(_Fragment5,null,_renderList5(_unref8(fm).links,([name,url])=>(_openBlock10(),_createElementBlock10("li",null,[_createElementVNode8("a",{href:url},[_createElementVNode8("span",null,_toDisplayString9(name),1)],8,_hoisted_27)]))),256))]))}});import{inject as inject9}from"vue";var _hoisted_111={class:"Aside"},_hoisted_28={key:2,class:"FourOFour"},_hoisted_35={key:3,class:"Related"},Aside_default=_defineComponent11({__name:"Aside",setup(__props){let fm=inject9("frontmatter");return(_ctx,_cache)=>(_openBlock11(),_createElementBlock11("aside",_hoisted_111,[_unref9(fm).isHome?(_openBlock11(),_createBlock2(Posts_default,{key:0})):_unref9(fm).isLinks?(_openBlock11(),_createBlock2(Links_default,{key:1})):_unref9(fm).is404?(_openBlock11(),_createElementBlock11("div",_hoisted_28," 404 ")):(_openBlock11(),_createElementBlock11("div",_hoisted_35," not "))]))}});import{inject as inject10}from"vue";var _hoisted_112=["href","data-lang"],Main_default=_defineComponent12({__name:"Main",setup(__props){let fm=inject10("frontmatter"),matchingFms=inject10("frontmatters").filter(potentialMatchingFm=>potentialMatchingFm.path.name===fm.path.name),youCanCheckOut=new Map([["en","This page is not yet available in your language. Meanwhile, you can check out"],["zh","此页尚未适配你的语言。在此期间，请查看"]]);return(_ctx,_cache)=>(_openBlock12(),_createElementBlock12("main",null,[_createElementVNode9("div",null,[_createVNode4(Article_default,null,{default:_withCtx2(()=>[_renderSlot3(_ctx.$slots,"default",{},()=>[_createElementVNode9("ul",null,[(_openBlock12(!0),_createElementBlock12(_Fragment6,null,_renderList6(_unref10(matchingFms),matchingFm=>(_openBlock12(),_createElementBlock12("li",null,[_createElementVNode9("p",null,_toDisplayString10(_unref10(youCanCheckOut).get(_unref10(fm).lang)||_unref10(youCanCheckOut).get(_unref10(fm).lang.slice(0,2))||_unref10(youCanCheckOut).get(_unref10(fm).defaultLang)||_unref10(youCanCheckOut).get(_unref10(fm).defaultLang.slice(0,2))),1),_createElementVNode9("a",{href:`/${matchingFm.slug}`,"data-lang":matchingFm.lang},_toDisplayString10(matchingFm.title),9,_hoisted_112)]))),256))])])]),_:3}),_createVNode4(Aside_default)])]))}});var subtle_default=_defineComponent13({__name:"index",setup(__props){return(_ctx,_cache)=>(_openBlock13(),_createElementBlock13(_Fragment7,null,[_createVNode5(Header_default),_createVNode5(Main_default,null,{default:_withCtx3(()=>[_renderSlot4(_ctx.$slots,"default")]),_:3}),_createVNode5(Footer_default)],64))}});import{Fragment as _Fragment8,jsx as _jsx,jsxs as _jsxs}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents}from"@mdx-js/vue";function _createMdxContent(props){let _components={p:"p",..._provideComponents(),...props.components};return _jsxs(_Fragment8,{children:[_jsx("p",{lang:"zh","data-id":"404",children:_jsx(_components.p,{children:"未知领域"})}),`
`,_jsx("p",{lang:"en","data-id":"404",children:_jsx(_components.p,{children:"You’ve landed on an unknown page."})}),`
`,_jsx("p",{hidden:!0,lang:"en","data-id":"tempUnavailable",children:_jsx(_components.p,{children:"Sorry, this page is not available in your language yet. Please check back later."})}),`
`,_jsx("p",{hidden:!0,lang:"zh","data-id":"tempUnavailable",children:_jsx(_components.p,{children:"抱歉，此页暂时无所选语言的版本，请稍后再看。"})}),`
`,_jsx("p",{hidden:!0,lang:"en","data-id":"unsupported",children:_jsx(_components.p,{children:"Sorry, this site is not available in your language."})}),`
`,_jsx("p",{hidden:!0,lang:"zh","data-id":"unsupported",children:_jsx(_components.p,{children:"抱歉，此网站不支持所选语言。"})})]})}__name(_createMdxContent,"_createMdxContent");function MDXContent(props={}){let{wrapper:MDXLayout}={..._provideComponents(),...props.components};return MDXLayout?_jsx(MDXLayout,{...props,children:_jsx(_createMdxContent,{...props})}):_createMdxContent(props)}__name(MDXContent,"MDXContent");import{Fragment as _Fragment9,jsx as _jsx2,jsxs as _jsxs2}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents2}from"@mdx-js/vue";function _createMdxContent2(props){let _components={li:"li",ol:"ol",p:"p",..._provideComponents2(),...props.components};return _jsxs2(_Fragment9,{children:[_jsx2(_components.p,{children:`Unfortunately, I wasn’t able to find
just-enough themes or static site generators for a personal blog. What we need is just a place to post random stuff.`}),`
`,_jsxs2("section",{children:[_jsx2(_components.p,{children:"What we don’t need is:"}),_jsxs2(_components.ol,{children:[`
`,_jsxs2(_components.li,{children:[`
`,_jsx2(_components.p,{children:"Multi-layered file structures - That’s more for a documentation site."}),`
`]}),`
`,_jsxs2(_components.li,{children:[`
`,_jsx2(_components.p,{children:`Flashy effects -
That’s more for selling a product.`}),`
`]}),`
`,_jsxs2(_components.li,{children:[`
`,_jsx2(_components.p,{children:"Dependency on JS - Some people disable JS."}),`
`]}),`
`,_jsxs2(_components.li,{children:[`
`,_jsx2(_components.p,{children:`Custom fonts -
Could be nice, but not absolutely necessary for a personal blog. Could add that as an option.`}),`
`]}),`
`]})]})]})}__name(_createMdxContent2,"_createMdxContent");function MDXContent2(props={}){let{wrapper:MDXLayout}={..._provideComponents2(),...props.components};return MDXLayout?_jsx2(MDXLayout,{...props,children:_jsx2(_createMdxContent2,{...props})}):_createMdxContent2(props)}__name(MDXContent2,"MDXContent");import{jsx as _jsx3}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents3}from"@mdx-js/vue";function _createMdxContent3(props){let _components={p:"p",..._provideComponents3(),...props.components};return _jsx3(_components.p,{children:`Here are my friends. Also, people who
commissioned or helped me with this project.`})}__name(_createMdxContent3,"_createMdxContent");function MDXContent3(props={}){let{wrapper:MDXLayout}={..._provideComponents3(),...props.components};return MDXLayout?_jsx3(MDXLayout,{...props,children:_jsx3(_createMdxContent3,{...props})}):_createMdxContent3(props)}__name(MDXContent3,"MDXContent");import{Fragment as _Fragment10,jsx as _jsx4,jsxs as _jsxs3}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents4}from"@mdx-js/vue";function _createMdxContent4(props){let _components={p:"p",..._provideComponents4(),...props.components};return _jsxs3(_Fragment10,{children:[_jsx4("p",{lang:"zh","data-id":"404",children:_jsx4(_components.p,{children:"未知领域"})}),`
`,_jsx4("p",{lang:"en","data-id":"404",children:_jsx4(_components.p,{children:"You’ve landed on an unknown page."})}),`
`,_jsx4("p",{hidden:!0,lang:"en","data-id":"tempUnavailable",children:_jsx4(_components.p,{children:"Sorry, this page is not available in your language yet. Please check back later."})}),`
`,_jsx4("p",{hidden:!0,lang:"zh","data-id":"tempUnavailable",children:_jsx4(_components.p,{children:"抱歉，此页暂时无所选语言的版本，请稍后再看。"})}),`
`,_jsx4("p",{hidden:!0,lang:"en","data-id":"unsupported",children:_jsx4(_components.p,{children:"Sorry, this site is not available in your language."})}),`
`,_jsx4("p",{hidden:!0,lang:"zh","data-id":"unsupported",children:_jsx4(_components.p,{children:"抱歉，此网站不支持所选语言。"})})]})}__name(_createMdxContent4,"_createMdxContent");function MDXContent4(props={}){let{wrapper:MDXLayout}={..._provideComponents4(),...props.components};return MDXLayout?_jsx4(MDXLayout,{...props,children:_jsx4(_createMdxContent4,{...props})}):_createMdxContent4(props)}__name(MDXContent4,"MDXContent");import{Fragment as _Fragment11,jsx as _jsx5,jsxs as _jsxs4}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents5}from"@mdx-js/vue";function _createMdxContent5(props){let _components={li:"li",ol:"ol",p:"p",..._provideComponents5(),...props.components};return _jsxs4(_Fragment11,{children:[_jsx5(_components.p,{children:`Unfortunately, I wasn’t able to find
just-enough themes or static site generators for a personal blog. What we need is just a place to post random stuff.`}),`
`,_jsxs4("section",{children:[_jsx5(_components.p,{children:"What we don’t need is:"}),_jsxs4(_components.ol,{children:[`
`,_jsxs4(_components.li,{children:[`
`,_jsx5(_components.p,{children:"Multi-layered file structures - That’s more for a documentation site."}),`
`]}),`
`,_jsxs4(_components.li,{children:[`
`,_jsx5(_components.p,{children:`Flashy effects -
That’s more for selling a product.`}),`
`]}),`
`,_jsxs4(_components.li,{children:[`
`,_jsx5(_components.p,{children:"Dependency on JS - Some people disable JS."}),`
`]}),`
`,_jsxs4(_components.li,{children:[`
`,_jsx5(_components.p,{children:`Custom fonts -
Could be nice, but not absolutely necessary for a personal blog. Could add that as an option.`}),`
`]}),`
`]})]})]})}__name(_createMdxContent5,"_createMdxContent");function MDXContent5(props={}){let{wrapper:MDXLayout}={..._provideComponents5(),...props.components};return MDXLayout?_jsx5(MDXLayout,{...props,children:_jsx5(_createMdxContent5,{...props})}):_createMdxContent5(props)}__name(MDXContent5,"MDXContent");import{jsx as _jsx6}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents6}from"@mdx-js/vue";function _createMdxContent6(props){let _components={p:"p",..._provideComponents6(),...props.components};return _jsx6(_components.p,{children:`Here are my friends. Also, people who
commissioned or helped me with this project.`})}__name(_createMdxContent6,"_createMdxContent");function MDXContent6(props={}){let{wrapper:MDXLayout}={..._provideComponents6(),...props.components};return MDXLayout?_jsx6(MDXLayout,{...props,children:_jsx6(_createMdxContent6,{...props})}):_createMdxContent6(props)}__name(MDXContent6,"MDXContent");import{Fragment as _Fragment12,jsx as _jsx7,jsxs as _jsxs5}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents7}from"@mdx-js/vue";function _createMdxContent7(props){let _components={p:"p",..._provideComponents7(),...props.components};return _jsxs5(_Fragment12,{children:[_jsx7("p",{lang:"zh","data-id":"404",children:_jsx7(_components.p,{children:"未知领域"})}),`
`,_jsx7("p",{lang:"en","data-id":"404",children:_jsx7(_components.p,{children:"You’ve landed on an unknown page."})}),`
`,_jsx7("p",{hidden:!0,lang:"en","data-id":"tempUnavailable",children:_jsx7(_components.p,{children:"Sorry, this page is not available in your language yet. Please check back later."})}),`
`,_jsx7("p",{hidden:!0,lang:"zh","data-id":"tempUnavailable",children:_jsx7(_components.p,{children:"抱歉，此页暂时无所选语言的版本，请稍后再看。"})}),`
`,_jsx7("p",{hidden:!0,lang:"en","data-id":"unsupported",children:_jsx7(_components.p,{children:"Sorry, this site is not available in your language."})}),`
`,_jsx7("p",{hidden:!0,lang:"zh","data-id":"unsupported",children:_jsx7(_components.p,{children:"抱歉，此网站不支持所选语言。"})})]})}__name(_createMdxContent7,"_createMdxContent");function MDXContent7(props={}){let{wrapper:MDXLayout}={..._provideComponents7(),...props.components};return MDXLayout?_jsx7(MDXLayout,{...props,children:_jsx7(_createMdxContent7,{...props})}):_createMdxContent7(props)}__name(MDXContent7,"MDXContent");import{Fragment as _Fragment13,jsx as _jsx8,jsxs as _jsxs6}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents8}from"@mdx-js/vue";function _createMdxContent8(props){let _components={li:"li",ol:"ol",p:"p",..._provideComponents8(),...props.components};return _jsxs6(_Fragment13,{children:[_jsx8(_components.p,{children:`Unfortunately, I wasn’t able to find
just-enough themes or static site generators for a personal blog. What we need is just a place to post random stuff.`}),`
`,_jsxs6("section",{children:[_jsx8(_components.p,{children:"What we don’t need is:"}),_jsxs6(_components.ol,{children:[`
`,_jsxs6(_components.li,{children:[`
`,_jsx8(_components.p,{children:"Multi-layered file structures - That’s more for a documentation site."}),`
`]}),`
`,_jsxs6(_components.li,{children:[`
`,_jsx8(_components.p,{children:`Flashy effects -
That’s more for selling a product.`}),`
`]}),`
`,_jsxs6(_components.li,{children:[`
`,_jsx8(_components.p,{children:"Dependency on JS - Some people disable JS."}),`
`]}),`
`,_jsxs6(_components.li,{children:[`
`,_jsx8(_components.p,{children:`Custom fonts -
Could be nice, but not absolutely necessary for a personal blog. Could add that as an option.`}),`
`]}),`
`]})]})]})}__name(_createMdxContent8,"_createMdxContent");function MDXContent8(props={}){let{wrapper:MDXLayout}={..._provideComponents8(),...props.components};return MDXLayout?_jsx8(MDXLayout,{...props,children:_jsx8(_createMdxContent8,{...props})}):_createMdxContent8(props)}__name(MDXContent8,"MDXContent");import{jsx as _jsx9}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents9}from"@mdx-js/vue";function _createMdxContent9(props){let _components={p:"p",..._provideComponents9(),...props.components};return _jsx9(_components.p,{children:`Here are my friends. Also, people who
commissioned or helped me with this project.`})}__name(_createMdxContent9,"_createMdxContent");function MDXContent9(props={}){let{wrapper:MDXLayout}={..._provideComponents9(),...props.components};return MDXLayout?_jsx9(MDXLayout,{...props,children:_jsx9(_createMdxContent9,{...props})}):_createMdxContent9(props)}__name(MDXContent9,"MDXContent");import{Fragment as _Fragment14,jsx as _jsx10,jsxs as _jsxs7}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents10}from"@mdx-js/vue";function _createMdxContent10(props){let _components={a:"a",blockquote:"blockquote",code:"code",del:"del",em:"em",h2:"h2",h3:"h3",img:"img",li:"li",ol:"ol",p:"p",pre:"pre",section:"section",span:"span",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",..._provideComponents10(),...props.components};return _jsxs7(_Fragment14,{children:[_jsxs7(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx10(_components.h2,{children:"Paragraph"}),`
`,_jsx10(_components.p,{children:"This is a paragraph."}),`
`,_jsx10(_components.p,{children:"This is a paragraph with just a few more words and just a few more words and just a few more words and just a few more words."}),`
`]}),_jsxs7(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx10(_components.h2,{children:"Images / Videos/Audios (function extension of this astro theme)"}),`
`,_jsx10(_components.pre,{children:_jsxs7(_components.code,{className:"hljs language-mdx",children:["![",_jsx10(_components.span,{className:"hljs-string",children:"alt text"}),"](",_jsx10(_components.span,{className:"hljs-link",children:"sample-image.png"}),`)
`]})}),`
`,`
`,_jsx10(_components.pre,{children:_jsxs7(_components.code,{className:"hljs language-html",children:[_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"a"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"href"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'./sample-image.png'"}),">"]}),`
  `,_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"picture"}),">"]}),`
    `,_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"source"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"srcset"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'sample-image.avif'"})," />"]}),`
    `,_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"source"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"srcset"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'sample-image.dark.avif'"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"media"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'(prefers-color-scheme: dark)'"})," />"]}),`
    `,_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"img"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"src"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'sample-image.avif'"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"alt"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'alt text'"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"height"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'1024'"}),", ",_jsx10(_components.span,{className:"hljs-attr",children:"width"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'1024'"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"loading"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'lazy'"})," />"]}),`
  `,_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"picture"}),">"]}),`
`,_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"a"}),">"]}),`
`]})}),`
`,_jsx10(_components.pre,{children:_jsxs7(_components.code,{className:"hljs language-mdx",children:["![",_jsx10(_components.span,{className:"hljs-string",children:"sample-video.vtt"}),"](",_jsx10(_components.span,{className:"hljs-link",children:"sample-video.mkv"}),`)
`]})}),`
`,_jsxs7(_components.p,{children:["This HTML output is stolen from ",_jsx10(_components.a,{href:"https://developer.mozilla.org/en-US/docs/Web/Media/Audio_and_video_delivery/Adding_captions_and_subtitles_to_HTML5_video",children:"MDN - Adding Captions and Subtitles to Video"}),"."]}),`
`,_jsx10(_components.pre,{children:_jsxs7(_components.code,{className:"hljs language-html",children:[_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"video"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"controls"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"preload"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'metadata'"}),">"]}),`
  `,_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"source"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"src"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'sample-video.mkv'"})," />"]}),`
  `,_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"track"}),`
    `,_jsx10(_components.span,{className:"hljs-attr",children:"src"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'sample-video.vtt'"}),`
    `,_jsx10(_components.span,{className:"hljs-attr",children:"default"})," />"]}),`
`,_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"video"}),">"]}),`
`]})}),`
`,_jsx10(_components.pre,{children:_jsxs7(_components.code,{className:"hljs language-mdx",children:["![",_jsx10(_components.span,{className:"hljs-string",children:"sample-audio.vtt"}),"](",_jsx10(_components.span,{className:"hljs-link",children:"sample-audio.opus"}),`)
`]})}),`
`,_jsxs7(_components.p,{children:["Using ",_jsx10(_components.code,{children:"<video>"})," instead of ",_jsx10(_components.code,{children:"<audio>"})," here because ",_jsx10(_components.code,{children:"<audio>"})," doesn’t support webvtt."]}),`
`,_jsx10(_components.pre,{children:_jsxs7(_components.code,{className:"hljs language-html",children:[_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"video"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"controls"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"preload"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'metadata'"}),">"]}),`
  `,_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"source"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"src"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'sample-audio.opus'"})," />"]}),`
  `,_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"track"}),`
    `,_jsx10(_components.span,{className:"hljs-attr",children:"src"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'sample-audio.vtt'"}),`
    `,_jsx10(_components.span,{className:"hljs-attr",children:"default"})," />"]}),`
`,_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"video"}),">"]}),`
`]})}),`
`,_jsxs7(_components.section,{className:"heading","data-heading-rank":"3",children:[_jsx10(_components.h3,{children:"Example"}),`
`,_jsx10(_components.p,{children:_jsx10(_components.img,{src:"/subtle/favicon.svg",alt:"favicon"})}),`
`,`
`]})]}),_jsxs7(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx10(_components.h2,{children:"Blockquotes"}),`
`,_jsx10(_components.pre,{children:_jsxs7(_components.code,{className:"hljs language-mdx",children:[_jsx10(_components.span,{className:"hljs-quote",children:"> Don't communicate by sharing memory, share memory by communicating."}),`
`,_jsxs7(_components.span,{className:"hljs-quote",children:[`>
> — `,_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"cite"}),">"]})}),"Rob Pike[^1]",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"cite"}),">"]})})]}),`
`]})}),`
`,_jsxs7(_components.blockquote,{children:[`
`,_jsx10(_components.p,{children:"Don’t communicate by sharing memory, share memory by communicating."}),`
`,_jsxs7(_components.p,{children:["— ",_jsxs7("cite",{children:["Rob Pike (The above quote is excerpted from Rob Pike’s ",_jsx10(_components.a,{href:"https://www.youtube.com/watch?v=PAAkCSZUG1c",children:"talk"})," during Gopherfest, November 18, 2015.)"]})]}),`
`]}),`
`]}),_jsxs7(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx10(_components.h2,{children:"Tables"}),`
`,_jsx10(_components.pre,{children:_jsxs7(_components.code,{className:"hljs language-mdx",children:[`| Italics | Bold | Code |
| --------- | -------- | ------ |
| `,_jsx10(_components.span,{className:"hljs-emphasis",children:"_italics_"})," | ",_jsx10(_components.span,{className:"hljs-strong",children:"**bold**"})," | ",_jsx10(_components.span,{className:"hljs-code",children:"`code`"}),` |
`]})}),`
`,_jsxs7(_components.table,{children:[_jsx10(_components.thead,{children:_jsxs7(_components.tr,{children:[_jsx10(_components.th,{children:"Italics"}),_jsx10(_components.th,{children:"Bold"}),_jsx10(_components.th,{children:"Code"})]})}),_jsxs7(_components.tbody,{children:[_jsxs7(_components.tr,{children:[_jsx10(_components.td,{children:_jsx10(_components.em,{children:"italics"})}),_jsx10(_components.td,{children:_jsx10(_components.strong,{children:"bold"})}),_jsx10(_components.td,{children:_jsx10(_components.code,{children:"code"})})]}),_jsxs7(_components.tr,{children:[_jsx10(_components.td,{children:_jsx10(_components.em,{children:"italics"})}),_jsx10(_components.td,{children:_jsx10(_components.strong,{children:"bold"})}),_jsx10(_components.td,{children:_jsx10(_components.code,{children:"code"})})]})]})]}),`
`]}),_jsxs7(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx10(_components.h2,{children:"UML"}),`
`,_jsx10(_components.pre,{children:_jsx10(_components.code,{className:"hljs language-uml",children:`start
:Hello world;
:This is defined on
several **lines**;
stop
`})}),`
`,_jsx10(_components.pre,{children:_jsxs7(_components.code,{className:"hljs language-html",children:[_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"a"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"href"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'./hello-world.pu'"}),">"]}),`
  `,_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"picture"}),">"]}),`
    `,_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"source"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"srcset"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'hello-world.svg'"})," />"]}),`
    `,_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"source"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"srcset"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'hello-world.dark.svg'"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"media"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'(prefers-color-scheme: dark)'"})," />"]}),`
    `,_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"img"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"src"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'hello-world.svg'"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"alt"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'alt text'"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"height"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'1024'"}),", ",_jsx10(_components.span,{className:"hljs-attr",children:"width"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'1024'"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"loading"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'lazy'"})," />"]}),`
  `,_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"picture"}),">"]}),`
`,_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"a"}),">"]}),`
`]})}),`
`]}),_jsxs7(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx10(_components.h2,{children:"List"}),`
`,_jsx10(_components.pre,{children:_jsxs7(_components.code,{className:"hljs language-mdx",children:[_jsx10(_components.span,{className:"hljs-bullet",children:"-"}),"   ",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"p"}),">"]})}),"Fruit",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"p"}),">"]})}),`
`,_jsx10(_components.span,{className:"hljs-bullet",children:"    -"}),`   Apple
`,_jsx10(_components.span,{className:"hljs-bullet",children:"    -"}),`   Orange
`,_jsx10(_components.span,{className:"hljs-bullet",children:"    -"}),`   Banana
`,_jsx10(_components.span,{className:"hljs-bullet",children:"    -"}),"   ",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"p"}),">"]})}),"Dairy",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"p"}),">"]})}),`
`,_jsx10(_components.span,{className:"hljs-bullet",children:"        1."}),`  Milk
`,_jsx10(_components.span,{className:"hljs-bullet",children:"        2."}),`  Cheese
`]})}),`
`,_jsxs7(_components.ul,{children:[`
`,_jsxs7(_components.li,{children:[`
`,_jsx10("p",{children:"Fruit"}),`
`,_jsxs7(_components.ul,{children:[`
`,_jsx10(_components.li,{children:"Apple"}),`
`,_jsx10(_components.li,{children:"Orange"}),`
`,_jsx10(_components.li,{children:"Banana"}),`
`,_jsxs7(_components.li,{children:[`
`,_jsx10("p",{children:"Dairy"}),`
`,_jsxs7(_components.ol,{children:[`
`,_jsx10(_components.li,{children:"Milk"}),`
`,_jsx10(_components.li,{children:"Cheese"}),`
`]}),`
`]}),`
`]}),`
`]}),`
`]}),`
`]}),_jsxs7(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx10(_components.h2,{children:"Other — abbr, sub, sup, kbd, mark, del"}),`
`,`
`,_jsx10(_components.pre,{children:_jsxs7(_components.code,{className:"hljs language-mdx",children:[_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"abbr"})," ",_jsx10(_components.span,{className:"hljs-attr",children:"title"}),"=",_jsx10(_components.span,{className:"hljs-string",children:"'Graphics Interchange Format'"}),">"]})}),"GIF",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"abbr"}),">"]})}),` is a bitmap image format.

H`,_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"sub"}),">"]})}),"2",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"sub"}),">"]})}),"O X",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"sup"}),">"]})}),"n",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"sup"}),">"]})})," + Y",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"sup"}),">"]})}),"n",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"sup"}),">"]})})," = Z",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"sup"}),">"]})}),"n",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"sup"}),">"]})}),`

Press `,_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"kbd"}),">"]})}),"CTRL",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"kbd"}),">"]})})," + ",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"kbd"}),">"]})}),"ALT",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"kbd"}),">"]})})," + ",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"kbd"}),">"]})}),"Delete",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"kbd"}),">"]})}),` to end the session.

Most `,_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["<",_jsx10(_components.span,{className:"hljs-name",children:"mark"}),">"]})}),"salamanders",_jsx10(_components.span,{className:"xml",children:_jsxs7(_components.span,{className:"hljs-tag",children:["</",_jsx10(_components.span,{className:"hljs-name",children:"mark"}),">"]})}),` are nocturnal, and hunt for insects, worms, and other small creatures.

~~strikethrough~~
`]})}),`
`,_jsxs7(_components.p,{children:[_jsx10("abbr",{title:"Graphics Interchange Format",children:"GIF"})," is a bitmap image format."]}),`
`,_jsxs7(_components.p,{children:["H",_jsx10("sub",{children:"2"}),"O X",_jsx10("sup",{children:"n"})," + Y",_jsx10("sup",{children:"n"})," = Z",_jsx10("sup",{children:"n"})]}),`
`,_jsxs7(_components.p,{children:["Press ",_jsx10("kbd",{children:"CTRL"})," + ",_jsx10("kbd",{children:"ALT"})," + ",_jsx10("kbd",{children:"Delete"})," to end the session."]}),`
`,_jsxs7(_components.p,{children:["Most ",_jsx10("mark",{children:"salamanders"})," are nocturnal, and hunt for insects, worms, and other small creatures."]}),`
`,_jsx10(_components.p,{children:_jsx10(_components.del,{children:"strikethrough"})})]})]})}__name(_createMdxContent10,"_createMdxContent");function MDXContent10(props={}){let{wrapper:MDXLayout}={..._provideComponents10(),...props.components};return MDXLayout?_jsx10(MDXLayout,{...props,children:_jsx10(_createMdxContent10,{...props})}):_createMdxContent10(props)}__name(MDXContent10,"MDXContent");import{jsx as _jsx11}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents11}from"@mdx-js/vue";function _createMdxContent11(props){let _components={p:"p",..._provideComponents11(),...props.components};return _jsx11(_components.p,{children:"en of only en and ca"})}__name(_createMdxContent11,"_createMdxContent");function MDXContent11(props={}){let{wrapper:MDXLayout}={..._provideComponents11(),...props.components};return MDXLayout?_jsx11(MDXLayout,{...props,children:_jsx11(_createMdxContent11,{...props})}):_createMdxContent11(props)}__name(MDXContent11,"MDXContent");import{Fragment as _Fragment15,jsx as _jsx12,jsxs as _jsxs8}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents12}from"@mdx-js/vue";function _createMdxContent12(props){let _components={p:"p",..._provideComponents12(),...props.components};return _jsxs8(_Fragment15,{children:[_jsx12("p",{lang:"zh","data-id":"404",children:_jsx12(_components.p,{children:"未知领域"})}),`
`,_jsx12("p",{lang:"en","data-id":"404",children:_jsx12(_components.p,{children:"You’ve landed on an unknown page."})}),`
`,_jsx12("p",{hidden:!0,lang:"en","data-id":"tempUnavailable",children:_jsx12(_components.p,{children:"Sorry, this page is not available in your language yet. Please check back later."})}),`
`,_jsx12("p",{hidden:!0,lang:"zh","data-id":"tempUnavailable",children:_jsx12(_components.p,{children:"抱歉，此页暂时无所选语言的版本，请稍后再看。"})}),`
`,_jsx12("p",{hidden:!0,lang:"en","data-id":"unsupported",children:_jsx12(_components.p,{children:"Sorry, this site is not available in your language."})}),`
`,_jsx12("p",{hidden:!0,lang:"zh","data-id":"unsupported",children:_jsx12(_components.p,{children:"抱歉，此网站不支持所选语言。"})})]})}__name(_createMdxContent12,"_createMdxContent");function MDXContent12(props={}){let{wrapper:MDXLayout}={..._provideComponents12(),...props.components};return MDXLayout?_jsx12(MDXLayout,{...props,children:_jsx12(_createMdxContent12,{...props})}):_createMdxContent12(props)}__name(MDXContent12,"MDXContent");import{Fragment as _Fragment16,jsx as _jsx13,jsxs as _jsxs9}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents13}from"@mdx-js/vue";function _createMdxContent13(props){let _components={li:"li",ol:"ol",p:"p",..._provideComponents13(),...props.components};return _jsxs9(_Fragment16,{children:[_jsx13(_components.p,{children:"不幸的是，我没能找到对于个人博客来说刚刚好的静态页面生成器主题。 需求只是有个地方放东西。"}),`
`,_jsxs9("section",{children:[_jsx13(_components.p,{children:"不需要"}),_jsxs9(_components.ol,{children:[`
`,_jsxs9(_components.li,{children:[`
`,_jsx13(_components.p,{children:"页面套页面 — 那对于文档站更适用。"}),`
`]}),`
`,_jsxs9(_components.li,{children:[`
`,_jsx13(_components.p,{children:"炫酷 — 又不是在卖东西"}),`
`]}),`
`,_jsxs9(_components.li,{children:[`
`,_jsx13(_components.p,{children:"硬需求 JS — 有人关掉"}),`
`]}),`
`,_jsxs9(_components.li,{children:[`
`,_jsx13(_components.p,{children:"非系统字体 —"}),`
`,_jsx13(_components.p,{children:"挺好，但是没必要 未来可以加上它这个选项。"}),`
`]}),`
`]})]})]})}__name(_createMdxContent13,"_createMdxContent");function MDXContent13(props={}){let{wrapper:MDXLayout}={..._provideComponents13(),...props.components};return MDXLayout?_jsx13(MDXLayout,{...props,children:_jsx13(_createMdxContent13,{...props})}):_createMdxContent13(props)}__name(MDXContent13,"MDXContent");import{jsx as _jsx14}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents14}from"@mdx-js/vue";function _createMdxContent14(props){let _components={p:"p",..._provideComponents14(),...props.components};return _jsx14(_components.p,{children:`朋友们。
或者建议我做这个项目或者帮我做这个项目的。`})}__name(_createMdxContent14,"_createMdxContent");function MDXContent14(props={}){let{wrapper:MDXLayout}={..._provideComponents14(),...props.components};return MDXLayout?_jsx14(MDXLayout,{...props,children:_jsx14(_createMdxContent14,{...props})}):_createMdxContent14(props)}__name(MDXContent14,"MDXContent");import{Fragment as _Fragment17,jsx as _jsx15,jsxs as _jsxs10}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents15}from"@mdx-js/vue";function _createMdxContent15(props){let _components={p:"p",..._provideComponents15(),...props.components};return _jsxs10(_Fragment17,{children:[_jsx15("p",{lang:"zh","data-id":"404",children:_jsx15(_components.p,{children:"未知领域"})}),`
`,_jsx15("p",{lang:"en","data-id":"404",children:_jsx15(_components.p,{children:"You’ve landed on an unknown page."})}),`
`,_jsx15("p",{hidden:!0,lang:"en","data-id":"tempUnavailable",children:_jsx15(_components.p,{children:"Sorry, this page is not available in your language yet. Please check back later."})}),`
`,_jsx15("p",{hidden:!0,lang:"zh","data-id":"tempUnavailable",children:_jsx15(_components.p,{children:"抱歉，此页暂时无所选语言的版本，请稍后再看。"})}),`
`,_jsx15("p",{hidden:!0,lang:"en","data-id":"unsupported",children:_jsx15(_components.p,{children:"Sorry, this site is not available in your language."})}),`
`,_jsx15("p",{hidden:!0,lang:"zh","data-id":"unsupported",children:_jsx15(_components.p,{children:"抱歉，此网站不支持所选语言。"})})]})}__name(_createMdxContent15,"_createMdxContent");function MDXContent15(props={}){let{wrapper:MDXLayout}={..._provideComponents15(),...props.components};return MDXLayout?_jsx15(MDXLayout,{...props,children:_jsx15(_createMdxContent15,{...props})}):_createMdxContent15(props)}__name(MDXContent15,"MDXContent");import{Fragment as _Fragment18,jsx as _jsx16,jsxs as _jsxs11}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents16}from"@mdx-js/vue";function _createMdxContent16(props){let _components={li:"li",ol:"ol",p:"p",..._provideComponents16(),...props.components};return _jsxs11(_Fragment18,{children:[_jsx16(_components.p,{children:"不幸的是，我没能找到对于个人博客来说刚刚好的静态页面生成器主题。 需求只是有个地方放东西。"}),`
`,_jsxs11("section",{children:[_jsx16(_components.p,{children:"不需要"}),_jsxs11(_components.ol,{children:[`
`,_jsxs11(_components.li,{children:[`
`,_jsx16(_components.p,{children:"页面套页面 — 那对于文档站更适用。"}),`
`]}),`
`,_jsxs11(_components.li,{children:[`
`,_jsx16(_components.p,{children:"炫酷 — 又不是在卖东西"}),`
`]}),`
`,_jsxs11(_components.li,{children:[`
`,_jsx16(_components.p,{children:"硬需求 JS — 有人关掉"}),`
`]}),`
`,_jsxs11(_components.li,{children:[`
`,_jsx16(_components.p,{children:"非系统字体 —"}),`
`,_jsx16(_components.p,{children:"挺好，但是没必要 未来可以加上它这个选项。"}),`
`]}),`
`]})]})]})}__name(_createMdxContent16,"_createMdxContent");function MDXContent16(props={}){let{wrapper:MDXLayout}={..._provideComponents16(),...props.components};return MDXLayout?_jsx16(MDXLayout,{...props,children:_jsx16(_createMdxContent16,{...props})}):_createMdxContent16(props)}__name(MDXContent16,"MDXContent");import{jsx as _jsx17}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents17}from"@mdx-js/vue";function _createMdxContent17(props){let _components={p:"p",..._provideComponents17(),...props.components};return _jsx17(_components.p,{children:`朋友们。
或者建议我做这个项目或者帮我做这个项目的。`})}__name(_createMdxContent17,"_createMdxContent");function MDXContent17(props={}){let{wrapper:MDXLayout}={..._provideComponents17(),...props.components};return MDXLayout?_jsx17(MDXLayout,{...props,children:_jsx17(_createMdxContent17,{...props})}):_createMdxContent17(props)}__name(MDXContent17,"MDXContent");import{jsx as _jsx18}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents18}from"@mdx-js/vue";function _createMdxContent18(props){let _components={p:"p",..._provideComponents18(),...props.components};return _jsx18(_components.p,{children:"ca of only ca and fr"})}__name(_createMdxContent18,"_createMdxContent");function MDXContent18(props={}){let{wrapper:MDXLayout}={..._provideComponents18(),...props.components};return MDXLayout?_jsx18(MDXLayout,{...props,children:_jsx18(_createMdxContent18,{...props})}):_createMdxContent18(props)}__name(MDXContent18,"MDXContent");import{jsx as _jsx19}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents19}from"@mdx-js/vue";function _createMdxContent19(props){let _components={p:"p",..._provideComponents19(),...props.components};return _jsx19(_components.p,{children:"ca of only en and ca"})}__name(_createMdxContent19,"_createMdxContent");function MDXContent19(props={}){let{wrapper:MDXLayout}={..._provideComponents19(),...props.components};return MDXLayout?_jsx19(MDXLayout,{...props,children:_jsx19(_createMdxContent19,{...props})}):_createMdxContent19(props)}__name(MDXContent19,"MDXContent");import{jsx as _jsx20}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents20}from"@mdx-js/vue";function _createMdxContent20(props){let _components={p:"p",..._provideComponents20(),...props.components};return _jsx20(_components.p,{children:"fr of only ca and fr"})}__name(_createMdxContent20,"_createMdxContent");function MDXContent20(props={}){let{wrapper:MDXLayout}={..._provideComponents20(),...props.components};return MDXLayout?_jsx20(MDXLayout,{...props,children:_jsx20(_createMdxContent20,{...props})}):_createMdxContent20(props)}__name(MDXContent20,"MDXContent");import{Fragment as _Fragment19,jsx as _jsx21,jsxs as _jsxs12}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents21}from"@mdx-js/vue";function _createMdxContent21(props){let _components={blockquote:"blockquote",code:"code",del:"del",em:"em",h2:"h2",h3:"h3",img:"img",li:"li",ol:"ol",p:"p",pre:"pre",section:"section",span:"span",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",..._provideComponents21(),...props.components};return _jsxs12(_Fragment19,{children:[_jsxs12(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx21(_components.h2,{children:"段落"}),`
`,_jsx21(_components.p,{children:"这是一段话。"}),`
`,_jsx21(_components.p,{children:"这是一段只有几句话，还有几句话，只是还有几句话，只是还有几句话。"}),`
`]}),_jsxs12(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx21(_components.h2,{children:"图片/视频/音频（本astro主题的功能扩展）"}),`
`,_jsx21(_components.pre,{children:_jsxs12(_components.code,{className:"hljs language-mdx",children:["![",_jsx21(_components.span,{className:"hljs-string",children:"替代文本"}),"](",_jsx21(_components.span,{className:"hljs-link",children:"sample-image.png"}),`)
`]})}),`
`,_jsx21(_components.pre,{children:_jsxs12(_components.code,{className:"hljs language-html",children:[_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"a"})," ",_jsx21(_components.span,{className:"hljs-attr",children:"href"}),"=",_jsx21(_components.span,{className:"hljs-string",children:"'./sample-image.png'"}),">"]}),`
   `,_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"picture"}),">"]}),`
     `,_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"source"})," ",_jsx21(_components.span,{className:"hljs-attr",children:"srcset"}),"=",_jsx21(_components.span,{className:"hljs-string",children:"'sample-image.avif'"})," />"]}),`
     `,_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"source"})," ",_jsx21(_components.span,{className:"hljs-attr",children:"srcset"}),"=",_jsx21(_components.span,{className:"hljs-string",children:"'sample-image.dark.avif'"})," ",_jsx21(_components.span,{className:"hljs-attr",children:"media"}),"=",_jsx21(_components.span,{className:"hljs-string",children:"'(prefers-color-scheme: dark)'"})," />"]}),`
     `,_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"img"})," ",_jsx21(_components.span,{className:"hljs-attr",children:"src"}),"=",_jsx21(_components.span,{className:"hljs-string",children:"'sample-image.avif'"})," ",_jsx21(_components.span,{className:"hljs-attr",children:"alt"}),"=",_jsx21(_components.span,{className:"hljs-string",children:"'替代文本'"})," ",_jsx21(_components.span,{className:"hljs-attr",children:"height"}),"=",_jsx21(_components.span,{className:"hljs-string",children:"'1024'"}),", ",_jsx21(_components.span,{className:"hljs-attr",children:"width"}),"=",_jsx21(_components.span,{className:"hljs-string",children:"'1024'"})," ",_jsx21(_components.span,{className:"hljs-attr",children:"loading"}),"=",_jsx21(_components.span,{className:"hljs-string",children:"'lazy'"})," />"]}),`
   `,_jsxs12(_components.span,{className:"hljs-tag",children:["</",_jsx21(_components.span,{className:"hljs-name",children:"picture"}),">"]}),`
`,_jsxs12(_components.span,{className:"hljs-tag",children:["</",_jsx21(_components.span,{className:"hljs-name",children:"a"}),">"]}),`
`]})}),`
`,_jsx21(_components.pre,{children:_jsxs12(_components.code,{className:"hljs language-mdx",children:["![",_jsx21(_components.span,{className:"hljs-string",children:"sample-video.vtt"}),"](",_jsx21(_components.span,{className:"hljs-link",children:"sample-video.mkv"}),`)
`]})}),`
`,_jsx21(_components.pre,{children:_jsxs12(_components.code,{className:"hljs language-html",children:[_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"video"})," ",_jsx21(_components.span,{className:"hljs-attr",children:"controls"})," ",_jsx21(_components.span,{className:"hljs-attr",children:"preload"}),"=",_jsx21(_components.span,{className:"hljs-string",children:"'metadata'"}),">"]}),`
  `,_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"source"})," ",_jsx21(_components.span,{className:"hljs-attr",children:"src"}),"=",_jsx21(_components.span,{className:"hljs-string",children:"'sample-video.mkv'"})," />"]}),`
  `,_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"track"}),`
    `,_jsx21(_components.span,{className:"hljs-attr",children:"src"}),"=",_jsx21(_components.span,{className:"hljs-string",children:"'sample-video.vtt'"}),`
    `,_jsx21(_components.span,{className:"hljs-attr",children:"default"})," />"]}),`
`,_jsxs12(_components.span,{className:"hljs-tag",children:["</",_jsx21(_components.span,{className:"hljs-name",children:"video"}),">"]}),`
`]})}),`
`,_jsx21(_components.pre,{children:_jsxs12(_components.code,{className:"hljs language-mdx",children:["![",_jsx21(_components.span,{className:"hljs-string",children:"sample-audio.vtt"}),"](",_jsx21(_components.span,{className:"hljs-link",children:"sample-audio.opus"}),`)
`]})}),`
`,_jsx21(_components.pre,{children:_jsxs12(_components.code,{className:"hljs language-html",children:[_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"video"})," ",_jsx21(_components.span,{className:"hljs-attr",children:"controls"})," ",_jsx21(_components.span,{className:"hljs-attr",children:"preload"}),"=",_jsx21(_components.span,{className:"hljs-string",children:"'metadata'"}),">"]}),`
  `,_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"source"})," ",_jsx21(_components.span,{className:"hljs-attr",children:"src"}),"=",_jsx21(_components.span,{className:"hljs-string",children:"'sample-audio.opus'"})," />"]}),`
  `,_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"track"}),`
    `,_jsx21(_components.span,{className:"hljs-attr",children:"src"}),"=",_jsx21(_components.span,{className:"hljs-string",children:"'sample-audio.vtt'"}),`
    `,_jsx21(_components.span,{className:"hljs-attr",children:"default"})," />"]}),`
`,_jsxs12(_components.span,{className:"hljs-tag",children:["</",_jsx21(_components.span,{className:"hljs-name",children:"video"}),">"]}),`
`]})}),`
`,_jsxs12(_components.section,{className:"heading","data-heading-rank":"3",children:[_jsx21(_components.h3,{children:"例"}),`
`,_jsx21(_components.p,{children:_jsx21(_components.img,{src:"/favicon.svg",alt:"favicon"})}),`
`]})]}),_jsxs12(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx21(_components.h2,{children:"Blockquotes"}),`
`,_jsx21(_components.pre,{children:_jsxs12(_components.code,{className:"hljs language-mdx",children:[_jsx21(_components.span,{className:"hljs-quote",children:"> 不要通过共享内存来通信，而是通过通信来共享内存。"}),`
`,_jsxs12(_components.span,{className:"hljs-quote",children:[`>
> — `,_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"cite"}),">"]})}),"罗布·派克",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["</",_jsx21(_components.span,{className:"hljs-name",children:"cite"}),">"]})})]}),`
`]})}),`
`,_jsxs12(_components.blockquote,{children:[`
`,_jsx21(_components.p,{children:"不要通过共享内存来通信，而是通过通信来共享内存。"}),`
`,_jsxs12(_components.p,{children:["— ",_jsx21("cite",{children:"罗布·派克"})]}),`
`]}),`
`]}),_jsxs12(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx21(_components.h2,{children:"表格"}),`
`,_jsx21(_components.p,{children:"“mdx"}),`
`,_jsxs12(_components.table,{children:[_jsx21(_components.thead,{children:_jsxs12(_components.tr,{children:[_jsx21(_components.th,{children:"斜体"}),_jsx21(_components.th,{children:"粗体"}),_jsx21(_components.th,{children:"代码"})]})}),_jsxs12(_components.tbody,{children:[_jsxs12(_components.tr,{children:[_jsx21(_components.td,{children:_jsx21(_components.em,{children:"斜体"})}),_jsx21(_components.td,{children:_jsx21(_components.strong,{children:"粗体"})}),_jsx21(_components.td,{children:_jsx21(_components.code,{children:"代码"})})]}),_jsxs12(_components.tr,{children:[_jsx21(_components.td,{children:_jsx21(_components.em,{children:"斜体"})}),_jsx21(_components.td,{children:_jsx21(_components.strong,{children:"粗体"})}),_jsx21(_components.td,{children:_jsx21(_components.code,{children:"代码"})})]})]})]}),`
`,_jsx21(_components.pre,{children:_jsx21(_components.code,{children:`
| 斜体| 粗体 | 代码 |
| ----- | -------- | ----- |
| _斜体_ | **粗体** | \`代码\` |
| _斜体_ | **粗体** | \`代码\` |

## UML

\`\`\`uml
start
:你好世界;
:这是定义在
**多行**;
stop
\`\`\`

\`\`\`\`html
<a href='./你好世界.pu'>
  <picture>
    <source srcset='你好世界.svg' />
    <source srcset='你好世界.dark.svg' media='(prefers-color-scheme: dark)' />
    <img src='你好世界.svg' alt='start
:你好世界;
:这是定义在
多行**;
stop' height='1024', width='1024' loading='lazy' />
  </picture>
</a>
`})}),`
`]}),_jsxs12(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx21(_components.h2,{children:"列表"}),`
`,_jsx21(_components.pre,{children:_jsxs12(_components.code,{className:"hljs language-mdx",children:[_jsx21(_components.span,{className:"hljs-bullet",children:"-"}),"   ",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"p"}),">"]})}),"水果",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["</",_jsx21(_components.span,{className:"hljs-name",children:"p"}),">"]})}),`
`,_jsx21(_components.span,{className:"hljs-bullet",children:"    -"}),`   苹果
`,_jsx21(_components.span,{className:"hljs-bullet",children:"    -"}),`   橙子
`,_jsx21(_components.span,{className:"hljs-bullet",children:"    -"}),`   香蕉
`,_jsx21(_components.span,{className:"hljs-bullet",children:"    -"}),"   ",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"p"}),">"]})}),"乳制品",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["</",_jsx21(_components.span,{className:"hljs-name",children:"p"}),">"]})}),`
`,_jsx21(_components.span,{className:"hljs-bullet",children:"        1."}),` 牛奶
`,_jsx21(_components.span,{className:"hljs-bullet",children:"        2."}),` 奶酪
`]})}),`
`,_jsxs12(_components.ul,{children:[`
`,_jsxs12(_components.li,{children:[`
`,_jsx21("p",{children:"水果"}),`
`,_jsxs12(_components.ul,{children:[`
`,_jsx21(_components.li,{children:"苹果"}),`
`,_jsx21(_components.li,{children:"橙子"}),`
`,_jsx21(_components.li,{children:"香蕉"}),`
`,_jsxs12(_components.li,{children:[`
`,_jsx21("p",{children:"乳制品"}),`
`,_jsxs12(_components.ol,{children:[`
`,_jsx21(_components.li,{children:"牛奶"}),`
`,_jsx21(_components.li,{children:"奶酪"}),`
`]}),`
`]}),`
`]}),`
`]}),`
`]}),`
`]}),_jsxs12(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx21(_components.h2,{children:"其它 — abbr、sub、sup、kbd、mark、del"}),`
`,_jsx21(_components.pre,{children:_jsxs12(_components.code,{className:"hljs language-mdx",children:[_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"abbr"})," ",_jsx21(_components.span,{className:"hljs-attr",children:"title"}),"=",_jsx21(_components.span,{className:"hljs-string",children:"'图形交换格式'"}),">"]})}),"GIF",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["</",_jsx21(_components.span,{className:"hljs-name",children:"abbr"}),">"]})}),` 是一种位图图像格式。

H`,_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"sub"}),">"]})}),"2",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["</",_jsx21(_components.span,{className:"hljs-name",children:"sub"}),">"]})}),"O X",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"sup"}),">"]})}),"n",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["</",_jsx21(_components.span,{className:"hljs-name",children:"sup"}),">"]})})," + Y",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"sup"}),">"]})}),"n",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["</",_jsx21(_components.span,{className:"hljs-name",children:"sup"}),">"]})})," = Z",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"sup"}),">"]})}),"n",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["</",_jsx21(_components.span,{className:"hljs-name",children:"sup"}),">"]})}),`

按 `,_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"kbd"}),">"]})}),"CTRL",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["</",_jsx21(_components.span,{className:"hljs-name",children:"kbd"}),">"]})})," + ",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"kbd"}),">"]})}),"ALT",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["</",_jsx21(_components.span,{className:"hljs-name",children:"kbd"}),">"]})})," + ",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"kbd"}),">"]})}),"Delete",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["</",_jsx21(_components.span,{className:"hljs-name",children:"kbd"}),">"]})}),` 结束会话。

大多数`,_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["<",_jsx21(_components.span,{className:"hljs-name",children:"mark"}),">"]})}),"火蜥蜴",_jsx21(_components.span,{className:"xml",children:_jsxs12(_components.span,{className:"hljs-tag",children:["</",_jsx21(_components.span,{className:"hljs-name",children:"mark"}),">"]})}),`都是夜间活动的，捕食昆虫、蠕虫和其他小生物。

~~删除线~~
`]})}),`
`,_jsxs12(_components.p,{children:[_jsx21("abbr",{title:"图形交换格式",children:"GIF"})," 是一种位图图像格式。"]}),`
`,_jsxs12(_components.p,{children:["H",_jsx21("sub",{children:"2"}),"O X",_jsx21("sup",{children:"n"})," + Y",_jsx21("sup",{children:"n"})," = Z",_jsx21("sup",{children:"n"})]}),`
`,_jsxs12(_components.p,{children:["按 ",_jsx21("kbd",{children:"CTRL"})," + ",_jsx21("kbd",{children:"ALT"})," + ",_jsx21("kbd",{children:"Delete"})," 结束会话。"]}),`
`,_jsxs12(_components.p,{children:["大多数",_jsx21("mark",{children:"火蜥蜴"}),"都是夜间活动的，捕食昆虫、蠕虫和其他小生物。"]}),`
`,_jsx21(_components.p,{children:_jsx21(_components.del,{children:"删除线"})})]})]})}__name(_createMdxContent21,"_createMdxContent");function MDXContent21(props={}){let{wrapper:MDXLayout}={..._provideComponents21(),...props.components};return MDXLayout?_jsx21(MDXLayout,{...props,children:_jsx21(_createMdxContent21,{...props})}):_createMdxContent21(props)}__name(MDXContent21,"MDXContent");import{Fragment as _Fragment20,jsx as _jsx22,jsxs as _jsxs13}from"vue/jsx-runtime";import{useMDXComponents as _provideComponents22}from"@mdx-js/vue";function _createMdxContent22(props){let _components={blockquote:"blockquote",code:"code",del:"del",em:"em",h2:"h2",h3:"h3",img:"img",li:"li",ol:"ol",p:"p",pre:"pre",section:"section",span:"span",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",..._provideComponents22(),...props.components};return _jsxs13(_Fragment20,{children:[_jsxs13(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx22(_components.h2,{children:"段落"}),`
`,_jsx22(_components.p,{children:"這是一段話。"}),`
`,_jsx22(_components.p,{children:"這是一段只有幾句話，還有幾句話，只是還有幾句話，只是還有幾句話。"}),`
`]}),_jsxs13(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx22(_components.h2,{children:"圖片/影片/音訊（本astro主題的功能擴充）"}),`
`,_jsx22(_components.pre,{children:_jsxs13(_components.code,{className:"hljs language-mdx",children:["![",_jsx22(_components.span,{className:"hljs-string",children:"替代文字"}),"](",_jsx22(_components.span,{className:"hljs-link",children:"sample-image.png"}),`)
`]})}),`
`,_jsx22(_components.pre,{children:_jsxs13(_components.code,{className:"hljs language-html",children:[_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"a"})," ",_jsx22(_components.span,{className:"hljs-attr",children:"href"}),"=",_jsx22(_components.span,{className:"hljs-string",children:"'./sample-image.png'"}),">"]}),`
    `,_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"picture"}),">"]}),`
      `,_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"source"})," ",_jsx22(_components.span,{className:"hljs-attr",children:"srcset"}),"=",_jsx22(_components.span,{className:"hljs-string",children:"'sample-image.avif'"})," />"]}),`
      `,_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"source"})," ",_jsx22(_components.span,{className:"hljs-attr",children:"srcset"}),"=",_jsx22(_components.span,{className:"hljs-string",children:"'sample-image.dark.avif'"})," ",_jsx22(_components.span,{className:"hljs-attr",children:"media"}),"=",_jsx22(_components.span,{className:"hljs-string",children:"'(prefers-color-scheme: dark)'"})," />"]}),`
      `,_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"img"})," ",_jsx22(_components.span,{className:"hljs-attr",children:"src"}),"=",_jsx22(_components.span,{className:"hljs-string",children:"'sample-image.avif'"})," ",_jsx22(_components.span,{className:"hljs-attr",children:"alt"}),"=",_jsx22(_components.span,{className:"hljs-string",children:"'替代文字'"})," ",_jsx22(_components.span,{className:"hljs-attr",children:"height"}),"=",_jsx22(_components.span,{className:"hljs-string",children:"'1024'"}),", ",_jsx22(_components.span,{className:"hljs-attr",children:"width"}),"=",_jsx22(_components.span,{className:"hljs-string",children:"'1024'"})," ",_jsx22(_components.span,{className:"hljs-attr",children:"loading"}),"=",_jsx22(_components.span,{className:"hljs-string",children:"'lazy'"})," />"]}),`
    `,_jsxs13(_components.span,{className:"hljs-tag",children:["</",_jsx22(_components.span,{className:"hljs-name",children:"picture"}),">"]}),`
`,_jsxs13(_components.span,{className:"hljs-tag",children:["</",_jsx22(_components.span,{className:"hljs-name",children:"a"}),">"]}),`
`]})}),`
`,_jsx22(_components.pre,{children:_jsxs13(_components.code,{className:"hljs language-mdx",children:["![",_jsx22(_components.span,{className:"hljs-string",children:"sample-video.vtt"}),"](",_jsx22(_components.span,{className:"hljs-link",children:"sample-video.mkv"}),`)
`]})}),`
`,_jsx22(_components.pre,{children:_jsxs13(_components.code,{className:"hljs language-html",children:[_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"video"})," ",_jsx22(_components.span,{className:"hljs-attr",children:"controls"})," ",_jsx22(_components.span,{className:"hljs-attr",children:"preload"}),"=",_jsx22(_components.span,{className:"hljs-string",children:"'metadata'"}),">"]}),`
   `,_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"source"})," ",_jsx22(_components.span,{className:"hljs-attr",children:"src"}),"=",_jsx22(_components.span,{className:"hljs-string",children:"'sample-video.mkv'"})," />"]}),`
   `,_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"track"}),`
     `,_jsx22(_components.span,{className:"hljs-attr",children:"src"}),"=",_jsx22(_components.span,{className:"hljs-string",children:"'sample-video.vtt'"}),`
     `,_jsx22(_components.span,{className:"hljs-attr",children:"default"})," />"]}),`
`,_jsxs13(_components.span,{className:"hljs-tag",children:["</",_jsx22(_components.span,{className:"hljs-name",children:"video"}),">"]}),`
`]})}),`
`,_jsx22(_components.pre,{children:_jsxs13(_components.code,{className:"hljs language-mdx",children:["![",_jsx22(_components.span,{className:"hljs-string",children:"sample-audio.vtt"}),"](",_jsx22(_components.span,{className:"hljs-link",children:"sample-audio.opus"}),`)
`]})}),`
`,_jsx22(_components.pre,{children:_jsxs13(_components.code,{className:"hljs language-html",children:[_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"video"})," ",_jsx22(_components.span,{className:"hljs-attr",children:"controls"})," ",_jsx22(_components.span,{className:"hljs-attr",children:"preload"}),"=",_jsx22(_components.span,{className:"hljs-string",children:"'metadata'"}),">"]}),`
   `,_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"source"})," ",_jsx22(_components.span,{className:"hljs-attr",children:"src"}),"=",_jsx22(_components.span,{className:"hljs-string",children:"'sample-audio.opus'"})," />"]}),`
   `,_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"track"}),`
     `,_jsx22(_components.span,{className:"hljs-attr",children:"src"}),"=",_jsx22(_components.span,{className:"hljs-string",children:"'sample-audio.vtt'"}),`
     `,_jsx22(_components.span,{className:"hljs-attr",children:"default"})," />"]}),`
`,_jsxs13(_components.span,{className:"hljs-tag",children:["</",_jsx22(_components.span,{className:"hljs-name",children:"video"}),">"]}),`
`]})}),`
`,_jsxs13(_components.section,{className:"heading","data-heading-rank":"3",children:[_jsx22(_components.h3,{children:"例"}),`
`,_jsx22(_components.p,{children:_jsx22(_components.img,{src:"/favicon.svg",alt:"favicon"})}),`
`]})]}),_jsxs13(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx22(_components.h2,{children:"Blockquotes"}),`
`,_jsx22(_components.pre,{children:_jsxs13(_components.code,{className:"hljs language-mdx",children:[_jsx22(_components.span,{className:"hljs-quote",children:"> 不要透過共享記憶體來通信，而是透過通信來共享記憶體。"}),`
`,_jsxs13(_components.span,{className:"hljs-quote",children:[`>
> — `,_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"cite"}),">"]})}),"羅布·派克[^1]",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["</",_jsx22(_components.span,{className:"hljs-name",children:"cite"}),">"]})})]}),`
`]})}),`
`,_jsxs13(_components.blockquote,{children:[`
`,_jsx22(_components.p,{children:"不要透過共享記憶體來通信，而是透過通信來共享記憶體。"}),`
`,_jsxs13(_components.p,{children:["— ",_jsx22("cite",{children:"羅布·派克"})]}),`
`]}),`
`]}),_jsxs13(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx22(_components.h2,{children:"表格"}),`
`,_jsx22(_components.p,{children:"“mdx"}),`
`,_jsxs13(_components.table,{children:[_jsx22(_components.thead,{children:_jsxs13(_components.tr,{children:[_jsx22(_components.th,{children:"斜體"}),_jsx22(_components.th,{children:"粗體"}),_jsx22(_components.th,{children:"代碼"})]})}),_jsxs13(_components.tbody,{children:[_jsxs13(_components.tr,{children:[_jsx22(_components.td,{children:_jsx22(_components.em,{children:"斜體"})}),_jsx22(_components.td,{children:_jsx22(_components.strong,{children:"粗體"})}),_jsx22(_components.td,{children:_jsx22(_components.code,{children:"代碼"})})]}),_jsxs13(_components.tr,{children:[_jsx22(_components.td,{children:_jsx22(_components.em,{children:"斜體"})}),_jsx22(_components.td,{children:_jsx22(_components.strong,{children:"粗體"})}),_jsx22(_components.td,{children:_jsx22(_components.code,{children:"代碼"})})]})]})]}),`
`,_jsx22(_components.pre,{children:_jsx22(_components.code,{children:`
| 斜體| 粗體 | 代碼 |
| ----- | -------- | ----- |
| _斜體_ | **粗體** | \`代碼\` |
| _斜體_ | **粗體** | \`代碼\` |

## UML

\`\`\`uml
start
:你好世界;
:這是定義在
**多行**;
stop
\`\`\`

\`\`\`\`html
<a href='./你好世界.pu'>
   <picture>
     <source srcset='你好世界.svg' />
     <source srcset='你好世界.dark.svg' media='(prefers-color-scheme: dark)' />
     <img src='你好世界.svg' alt='start
:你好世界;
:這是定義在
多行**;
stop' height='1024', width='1024' loading='lazy' />
   </picture>
</a>
`})}),`
`]}),_jsxs13(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx22(_components.h2,{children:"列表"}),`
`,_jsx22(_components.pre,{children:_jsxs13(_components.code,{className:"hljs language-mdx",children:[_jsx22(_components.span,{className:"hljs-bullet",children:"-"})," ",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"p"}),">"]})}),"水果",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["</",_jsx22(_components.span,{className:"hljs-name",children:"p"}),">"]})}),`
`,_jsx22(_components.span,{className:"hljs-bullet",children:"     -"}),` 蘋果
`,_jsx22(_components.span,{className:"hljs-bullet",children:"     -"}),`   橘子
`,_jsx22(_components.span,{className:"hljs-bullet",children:"     -"}),` 香蕉
`,_jsx22(_components.span,{className:"hljs-bullet",children:"     -"})," ",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"p"}),">"]})}),"乳製品",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["</",_jsx22(_components.span,{className:"hljs-name",children:"p"}),">"]})}),`
`,_jsx22(_components.span,{className:"hljs-bullet",children:"         1."}),` 牛奶
`,_jsx22(_components.span,{className:"hljs-bullet",children:"         2."}),` 乳酪
`]})}),`
`,_jsxs13(_components.ul,{children:[`
`,_jsxs13(_components.li,{children:[`
`,_jsx22("p",{children:"水果"}),`
`,_jsxs13(_components.ul,{children:[`
`,_jsx22(_components.li,{children:"蘋果"}),`
`,_jsx22(_components.li,{children:"橘子"}),`
`,_jsx22(_components.li,{children:"香蕉"}),`
`,_jsxs13(_components.li,{children:[`
`,_jsx22("p",{children:"乳製品"}),`
`,_jsxs13(_components.ol,{children:[`
`,_jsx22(_components.li,{children:"牛奶"}),`
`,_jsx22(_components.li,{children:"乳酪"}),`
`]}),`
`]}),`
`]}),`
`]}),`
`]}),`
`]}),_jsxs13(_components.section,{className:"heading","data-heading-rank":"2",children:[_jsx22(_components.h2,{children:"其它 — abbr、sub、sup、kbd、mark、del"}),`
`,_jsx22(_components.pre,{children:_jsxs13(_components.code,{className:"hljs language-mdx",children:[_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"abbr"})," ",_jsx22(_components.span,{className:"hljs-attr",children:"title"}),"=",_jsx22(_components.span,{className:"hljs-string",children:"'圖形交換格式'"}),">"]})}),"GIF",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["</",_jsx22(_components.span,{className:"hljs-name",children:"abbr"}),">"]})}),` 是一種點陣圖影像格式。

H`,_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"sub"}),">"]})}),"2",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["</",_jsx22(_components.span,{className:"hljs-name",children:"sub"}),">"]})}),"O X",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"sup"}),">"]})}),"n",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["</",_jsx22(_components.span,{className:"hljs-name",children:"sup"}),">"]})})," + Y",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"sup"}),">"]})}),"n",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["</",_jsx22(_components.span,{className:"hljs-name",children:"sup"}),">"]})})," = Z",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"sup"}),">"]})}),"n",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["</",_jsx22(_components.span,{className:"hljs-name",children:"sup"}),">"]})}),`

按 `,_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"kbd"}),">"]})}),"CTRL",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["</",_jsx22(_components.span,{className:"hljs-name",children:"kbd"}),">"]})})," + ",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"kbd"}),">"]})}),"ALT",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["</",_jsx22(_components.span,{className:"hljs-name",children:"kbd"}),">"]})})," + ",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"kbd"}),">"]})}),"Delete",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["</",_jsx22(_components.span,{className:"hljs-name",children:"kbd"}),">"]})}),` 結束會話。

大多數`,_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["<",_jsx22(_components.span,{className:"hljs-name",children:"mark"}),">"]})}),"蠑螈",_jsx22(_components.span,{className:"xml",children:_jsxs13(_components.span,{className:"hljs-tag",children:["</",_jsx22(_components.span,{className:"hljs-name",children:"mark"}),">"]})}),`都是夜間活動的，捕食昆蟲、蠕蟲和其他小生物。

~~刪除線~~
`]})}),`
`,_jsxs13(_components.p,{children:[_jsx22("abbr",{title:"圖形交換格式",children:"GIF"})," 是一種點陣圖影像格式。"]}),`
`,_jsxs13(_components.p,{children:["H",_jsx22("sub",{children:"2"}),"O X",_jsx22("sup",{children:"n"})," + Y",_jsx22("sup",{children:"n"})," = Z",_jsx22("sup",{children:"n"})]}),`
`,_jsxs13(_components.p,{children:["按 ",_jsx22("kbd",{children:"CTRL"})," + ",_jsx22("kbd",{children:"ALT"})," + ",_jsx22("kbd",{children:"Delete"})," 結束會話。"]}),`
`,_jsxs13(_components.p,{children:["大多數",_jsx22("mark",{children:"蠑螈"}),"都是夜間活動的，捕食昆蟲、蠕蟲和其他小生物。"]}),`
`,_jsx22(_components.p,{children:_jsx22(_components.del,{children:"刪除線"})})]})]})}__name(_createMdxContent22,"_createMdxContent");function MDXContent22(props={}){let{wrapper:MDXLayout}={..._provideComponents22(),...props.components};return MDXLayout?_jsx22(MDXLayout,{...props,children:_jsx22(_createMdxContent22,{...props})}):_createMdxContent22(props)}__name(MDXContent22,"MDXContent");var __default=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle"],["name","404"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/404"],["defaultLang","en"],["description","Personal Blog SSG and Theme built with Vue 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlash404ReplacedDottoml"],["frontmatterPath","subtle/404.toml"],["fullTitle","404 | Subtle"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/404.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/404"],["isHome",!1],["isLinks",!1],["is404",!0],["isPost",!1],["lang","en"],["latest",new Date("2024-05-19T07:33:58.212Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`<p
lang='zh'
data-id='404'>
未知领域
</p>

<p
lang='en'
data-id='404'>
You've landed on an unknown page.
</p>

<p
hidden
lang='en'
data-id='tempUnavailable'>
Sorry, this page is not available in your language yet. Please check back later.
</p>
<p
hidden
lang='zh'
data-id='tempUnavailable'>
抱歉，此页暂时无所选语言的版本，请稍后再看。
</p>

<p
hidden
lang='en'
data-id='unsupported'>
Sorry, this site is not available in your language.
</p>
<p
hidden
lang='zh'
data-id='unsupported'>
抱歉，此网站不支持所选语言。
</p>
`],["postImportName","subtleReplacedSlash404ReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle"],["slashSiteBaseWLangWSlash","/subtle/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","Subtle"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/404.html"],["slugWIndexWoExt","subtle/404"],["slug","subtle/404"],["socials",Object.freeze(new Map([["RSS Feed","https://aquati.cat/rss"],["Email","mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`<p
lang='zh'
data-id='404'>
未知领域
</p> <p
lang='en'
data-id='404'>
You've landed on an unknown page.
</p> <p
hidden
lang='en'
data-id='tempUnavailable'>
Sorry, this page is not available in your language yet. Please check back later.
</p>
<p
hidden
lang='zh'
data-id='tempUnavailable'>
抱歉，此页暂时无所选语言的版本，请稍后再看。
</p> <p
hidden
lang='en'
data-id='unsupported'>
Sorry, this site is not available in your language.
</p>
<p
hidden
lang='zh'
data-id='unsupported'>
抱歉，此网站不支持所选语言。
</p>`],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","404"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var subtle_default2=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle"],["name","index"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle"],["defaultLang","en"],["description","Personal Blog SSG and Theme built with Vue 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashindexReplacedDottoml"],["frontmatterPath","subtle/index.toml"],["fullTitle","Subtle"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/index.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/index"],["isHome",!0],["isLinks",!1],["is404",!1],["isPost",!1],["lang","en"],["latest",new Date("2024-05-19T07:33:58.213Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`Unfortunately, I wasn't able to find
just-enough themes or static site generators for a personal blog. What we need is just a place to post random stuff.

<section>
  What we don't need is:

  1.  Multi-layered file structures - That's more for a documentation site.

  2.  Flashy effects -
      That's more for selling a product.

  3. Dependency on JS - Some people disable JS.

  4. Custom fonts -
     Could be nice, but not absolutely necessary for a personal blog. Could add that as an option.
</section>
`],["postImportName","subtleReplacedSlashindexReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle"],["slashSiteBaseWLangWSlash","/subtle/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","Subtle"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/index.html"],["slugWIndexWoExt","subtle/index"],["slug","subtle"],["socials",Object.freeze(new Map([["RSS Feed","https://aquati.cat/rss"],["Email","mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`Unfortunately, I wasn't able to find
just-enough themes or static site generators for a personal blog. What we need is just a place to post random stuff. <section>
  What we don't need is: Multi-layered file structures - That's more for a documentation site. Flashy effects -
That's more for selling a product. Dependency on JS - Some people disable JS. Custom fonts -
Could be nice, but not absolutely necessary for a personal blog. Could add that as an option.</section>`],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","Subtle"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var links_default=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle"],["name","links"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/links"],["defaultLang","en"],["description","Personal Blog SSG and Theme built with Vue 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashlinksReplacedDottoml"],["frontmatterPath","subtle/links.toml"],["fullTitle","Links | Subtle"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/links.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/links"],["isHome",!1],["isLinks",!0],["is404",!1],["isPost",!1],["lang","en"],["latest",new Date("2024-05-19T07:33:58.211Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`Here are my friends. Also, people who
commissioned or helped me with this project.
`],["postImportName","subtleReplacedSlashlinksReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle"],["slashSiteBaseWLangWSlash","/subtle/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","Subtle"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/links.html"],["slugWIndexWoExt","subtle/links"],["slug","subtle/links"],["socials",Object.freeze(new Map([["RSS Feed","https://aquati.cat/rss"],["Email","mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`Here are my friends. Also, people who
commissioned or helped me with this project.`],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","Links"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var __default2=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/ca"],["name","404"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/ca/404"],["defaultLang","en"],["description","Personal Blog SSG and Theme built with Vue 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashcaReplacedSlash404ReplacedDottoml"],["frontmatterPath","subtle/ca/404.toml"],["fullTitle","404 | Subtle"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/ca/404.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/ca/404"],["isHome",!1],["isLinks",!1],["is404",!0],["isPost",!1],["lang","ca"],["latest",new Date("2024-05-19T07:33:58.222Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`<p
lang='zh'
data-id='404'>
未知领域
</p>

<p
lang='en'
data-id='404'>
You've landed on an unknown page.
</p>

<p
hidden
lang='en'
data-id='tempUnavailable'>
Sorry, this page is not available in your language yet. Please check back later.
</p>
<p
hidden
lang='zh'
data-id='tempUnavailable'>
抱歉，此页暂时无所选语言的版本，请稍后再看。
</p>

<p
hidden
lang='en'
data-id='unsupported'>
Sorry, this site is not available in your language.
</p>
<p
hidden
lang='zh'
data-id='unsupported'>
抱歉，此网站不支持所选语言。
</p>
`],["postImportName","subtleReplacedSlashcaReplacedSlash404ReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/ca"],["slashSiteBaseWLangWSlash","/subtle/ca/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","Subtle"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/ca/404.html"],["slugWIndexWoExt","subtle/ca/404"],["slug","subtle/ca/404"],["socials",Object.freeze(new Map([["RSS Feed","https://aquati.cat/rss"],["Email","mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`<p
lang='zh'
data-id='404'>
未知领域
</p> <p
lang='en'
data-id='404'>
You've landed on an unknown page.
</p> <p
hidden
lang='en'
data-id='tempUnavailable'>
Sorry, this page is not available in your language yet. Please check back later.
</p>
<p
hidden
lang='zh'
data-id='tempUnavailable'>
抱歉，此页暂时无所选语言的版本，请稍后再看。
</p> <p
hidden
lang='en'
data-id='unsupported'>
Sorry, this site is not available in your language.
</p>
<p
hidden
lang='zh'
data-id='unsupported'>
抱歉，此网站不支持所选语言。
</p>`],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","404"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var ca_default=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/ca"],["name","index"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/ca"],["defaultLang","en"],["description","Personal Blog SSG and Theme built with Vue 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashcaReplacedSlashindexReplacedDottoml"],["frontmatterPath","subtle/ca/index.toml"],["fullTitle","Subtle"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/ca/index.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/ca/index"],["isHome",!0],["isLinks",!1],["is404",!1],["isPost",!1],["lang","ca"],["latest",new Date("2024-05-19T07:33:58.223Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`Unfortunately, I wasn't able to find
just-enough themes or static site generators for a personal blog. What we need is just a place to post random stuff.

<section>
  What we don't need is:

  1.  Multi-layered file structures - That's more for a documentation site.

  2.  Flashy effects -
      That's more for selling a product.

  3. Dependency on JS - Some people disable JS.

  4. Custom fonts -
     Could be nice, but not absolutely necessary for a personal blog. Could add that as an option.
</section>
`],["postImportName","subtleReplacedSlashcaReplacedSlashindexReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/ca"],["slashSiteBaseWLangWSlash","/subtle/ca/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","Subtle"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/ca/index.html"],["slugWIndexWoExt","subtle/ca/index"],["slug","subtle/ca"],["socials",Object.freeze(new Map([["RSS Feed","https://aquati.cat/rss"],["Email","mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`Unfortunately, I wasn't able to find
just-enough themes or static site generators for a personal blog. What we need is just a place to post random stuff. <section>
  What we don't need is: Multi-layered file structures - That's more for a documentation site. Flashy effects -
That's more for selling a product. Dependency on JS - Some people disable JS. Custom fonts -
Could be nice, but not absolutely necessary for a personal blog. Could add that as an option.</section>`],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","Subtle"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var links_default2=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/ca"],["name","links"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/ca/links"],["defaultLang","en"],["description","Personal Blog SSG and Theme built with Vue 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashcaReplacedSlashlinksReplacedDottoml"],["frontmatterPath","subtle/ca/links.toml"],["fullTitle","Links | Subtle"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/ca/links.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/ca/links"],["isHome",!1],["isLinks",!0],["is404",!1],["isPost",!1],["lang","ca"],["latest",new Date("2024-05-19T07:33:58.222Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`Here are my friends. Also, people who
commissioned or helped me with this project.
`],["postImportName","subtleReplacedSlashcaReplacedSlashlinksReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/ca"],["slashSiteBaseWLangWSlash","/subtle/ca/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","Subtle"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/ca/links.html"],["slugWIndexWoExt","subtle/ca/links"],["slug","subtle/ca/links"],["socials",Object.freeze(new Map([["RSS Feed","https://aquati.cat/rss"],["Email","mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`Here are my friends. Also, people who
commissioned or helped me with this project.`],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","Links"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var __default3=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/fr"],["name","404"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/fr/404"],["defaultLang","en"],["description","Personal Blog SSG and Theme built with Vue 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashfrReplacedSlash404ReplacedDottoml"],["frontmatterPath","subtle/fr/404.toml"],["fullTitle","404 | Subtle"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/fr/404.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/fr/404"],["isHome",!1],["isLinks",!1],["is404",!0],["isPost",!1],["lang","fr"],["latest",new Date("2024-05-19T07:33:58.223Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`<p
lang='zh'
data-id='404'>
未知领域
</p>

<p
lang='en'
data-id='404'>
You've landed on an unknown page.
</p>

<p
hidden
lang='en'
data-id='tempUnavailable'>
Sorry, this page is not available in your language yet. Please check back later.
</p>
<p
hidden
lang='zh'
data-id='tempUnavailable'>
抱歉，此页暂时无所选语言的版本，请稍后再看。
</p>

<p
hidden
lang='en'
data-id='unsupported'>
Sorry, this site is not available in your language.
</p>
<p
hidden
lang='zh'
data-id='unsupported'>
抱歉，此网站不支持所选语言。
</p>
`],["postImportName","subtleReplacedSlashfrReplacedSlash404ReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/fr"],["slashSiteBaseWLangWSlash","/subtle/fr/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","Subtle"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/fr/404.html"],["slugWIndexWoExt","subtle/fr/404"],["slug","subtle/fr/404"],["socials",Object.freeze(new Map([["RSS Feed","https://aquati.cat/rss"],["Email","mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`<p
lang='zh'
data-id='404'>
未知领域
</p> <p
lang='en'
data-id='404'>
You've landed on an unknown page.
</p> <p
hidden
lang='en'
data-id='tempUnavailable'>
Sorry, this page is not available in your language yet. Please check back later.
</p>
<p
hidden
lang='zh'
data-id='tempUnavailable'>
抱歉，此页暂时无所选语言的版本，请稍后再看。
</p> <p
hidden
lang='en'
data-id='unsupported'>
Sorry, this site is not available in your language.
</p>
<p
hidden
lang='zh'
data-id='unsupported'>
抱歉，此网站不支持所选语言。
</p>`],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","404"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var fr_default=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/fr"],["name","index"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/fr"],["defaultLang","en"],["description","Personal Blog SSG and Theme built with Vue 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashfrReplacedSlashindexReplacedDottoml"],["frontmatterPath","subtle/fr/index.toml"],["fullTitle","Subtle"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/fr/index.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/fr/index"],["isHome",!0],["isLinks",!1],["is404",!1],["isPost",!1],["lang","fr"],["latest",new Date("2024-05-19T07:33:58.223Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`Unfortunately, I wasn't able to find
just-enough themes or static site generators for a personal blog. What we need is just a place to post random stuff.

<section>
  What we don't need is:

  1.  Multi-layered file structures - That's more for a documentation site.

  2.  Flashy effects -
      That's more for selling a product.

  3. Dependency on JS - Some people disable JS.

  4. Custom fonts -
     Could be nice, but not absolutely necessary for a personal blog. Could add that as an option.
</section>
`],["postImportName","subtleReplacedSlashfrReplacedSlashindexReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/fr"],["slashSiteBaseWLangWSlash","/subtle/fr/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","Subtle"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/fr/index.html"],["slugWIndexWoExt","subtle/fr/index"],["slug","subtle/fr"],["socials",Object.freeze(new Map([["RSS Feed","https://aquati.cat/rss"],["Email","mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`Unfortunately, I wasn't able to find
just-enough themes or static site generators for a personal blog. What we need is just a place to post random stuff. <section>
  What we don't need is: Multi-layered file structures - That's more for a documentation site. Flashy effects -
That's more for selling a product. Dependency on JS - Some people disable JS. Custom fonts -
Could be nice, but not absolutely necessary for a personal blog. Could add that as an option.</section>`],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","Subtle"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var links_default3=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/fr"],["name","links"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/fr/links"],["defaultLang","en"],["description","Personal Blog SSG and Theme built with Vue 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashfrReplacedSlashlinksReplacedDottoml"],["frontmatterPath","subtle/fr/links.toml"],["fullTitle","Links | Subtle"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/fr/links.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/fr/links"],["isHome",!1],["isLinks",!0],["is404",!1],["isPost",!1],["lang","fr"],["latest",new Date("2024-05-19T07:33:58.223Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`Here are my friends. Also, people who
commissioned or helped me with this project.
`],["postImportName","subtleReplacedSlashfrReplacedSlashlinksReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/fr"],["slashSiteBaseWLangWSlash","/subtle/fr/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","Subtle"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/fr/links.html"],["slugWIndexWoExt","subtle/fr/links"],["slug","subtle/fr/links"],["socials",Object.freeze(new Map([["RSS Feed","https://aquati.cat/rss"],["Email","mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`Here are my friends. Also, people who
commissioned or helped me with this project.`],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","Links"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var mdx_default=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/post"],["name","mdx"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/post/mdx"],["defaultLang","en"],["description","Here is a sample of some syntax that can be used when writing mdx content in this Astro theme."],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashpostReplacedSlashmdxReplacedDottoml"],["frontmatterPath","subtle/post/mdx.toml"],["fullTitle","Using MDX | Subtle"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/post/mdx.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/post/mdx"],["isHome",!1],["isLinks",!1],["is404",!1],["isPost",!0],["lang","en"],["latest",new Date("2024-05-19T07:33:58.223Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`## Paragraph

This is a paragraph.

This is a paragraph with just a few more words and just a few more words and just a few more words and just a few more words.

## Images / Videos/Audios (function extension of this astro theme)

\`\`\`mdx
![alt text](sample-image.png)
\`\`\`

{ /* TODO: This HTML output needs testing for a11y */ }

\`\`\`html
<a href='./sample-image.png'>
  <picture>
    <source srcset='sample-image.avif' />
    <source srcset='sample-image.dark.avif' media='(prefers-color-scheme: dark)' />
    <img src='sample-image.avif' alt='alt text' height='1024', width='1024' loading='lazy' />
  </picture>
</a>
\`\`\`

\`\`\`mdx
![sample-video.vtt](sample-video.mkv)
\`\`\`

This HTML output is stolen from [MDN - Adding Captions and Subtitles to Video](https://developer.mozilla.org/en-US/docs/Web/Media/Audio_and_video_delivery/Adding_captions_and_subtitles_to_HTML5_video).

\`\`\`html
<video controls preload='metadata'>
  <source src='sample-video.mkv' />
  <track
    src='sample-video.vtt'
    default />
</video>
\`\`\`

\`\`\`mdx
![sample-audio.vtt](sample-audio.opus)
\`\`\`

Using \`<video>\` instead of \`<audio>\` here because \`<audio>\` doesn't support webvtt.

\`\`\`html
<video controls preload='metadata'>
  <source src='sample-audio.opus' />
  <track
    src='sample-audio.vtt'
    default />
</video>
\`\`\`

### Example

![favicon](/subtle/favicon.svg)

{/* TODO: List more examples. */}

## Blockquotes

\`\`\`mdx
> Don't communicate by sharing memory, share memory by communicating.
>
> — <cite>Rob Pike[^1]</cite>
\`\`\`
> Don't communicate by sharing memory, share memory by communicating.
>
> — <cite>Rob Pike (The above quote is excerpted from Rob Pike's [talk](https://www.youtube.com/watch?v=PAAkCSZUG1c) during Gopherfest, November 18, 2015.)</cite>

## Tables

\`\`\`mdx
| Italics | Bold | Code |
| --------- | -------- | ------ |
| _italics_ | **bold** | \`code\` |
\`\`\`

| Italics | Bold | Code |
| --------- | -------- | ------ |
| _italics_ | **bold** | \`code\` |
| _italics_ | **bold** | \`code\` |

## UML

\`\`\`uml
start
:Hello world;
:This is defined on
several **lines**;
stop
\`\`\`

\`\`\`html
<a href='./hello-world.pu'>
  <picture>
    <source srcset='hello-world.svg' />
    <source srcset='hello-world.dark.svg' media='(prefers-color-scheme: dark)' />
    <img src='hello-world.svg' alt='alt text' height='1024', width='1024' loading='lazy' />
  </picture>
</a>
\`\`\`

## List

\`\`\`mdx
-   <p>Fruit</p>
    -   Apple
    -   Orange
    -   Banana
    -   <p>Dairy</p>
        1.  Milk
        2.  Cheese
\`\`\`
-   <p>Fruit</p>
    -   Apple
    -   Orange
    -   Banana
    -   <p>Dairy</p>
        1.  Milk
        2.  Cheese

## Other — abbr, sub, sup, kbd, mark, del

{/* TODO: reimplement title */}

\`\`\`mdx
<abbr title='Graphics Interchange Format'>GIF</abbr> is a bitmap image format.

H<sub>2</sub>O X<sup>n</sup> + Y<sup>n</sup> = Z<sup>n</sup>

Press <kbd>CTRL</kbd> + <kbd>ALT</kbd> + <kbd>Delete</kbd> to end the session.

Most <mark>salamanders</mark> are nocturnal, and hunt for insects, worms, and other small creatures.

~~strikethrough~~
\`\`\`

<abbr title='Graphics Interchange Format'>GIF</abbr> is a bitmap image format.

H<sub>2</sub>O X<sup>n</sup> + Y<sup>n</sup> = Z<sup>n</sup>

Press <kbd>CTRL</kbd> + <kbd>ALT</kbd> + <kbd>Delete</kbd> to end the session.

Most <mark>salamanders</mark> are nocturnal, and hunt for insects, worms, and other small creatures.

~~strikethrough~~
`],["postImportName","subtleReplacedSlashpostReplacedSlashmdxReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2022-07-01T12:00:00.000Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle"],["slashSiteBaseWLangWSlash","/subtle/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","Subtle"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/post/mdx.html"],["slugWIndexWoExt","subtle/post/mdx"],["slug","subtle/post/mdx"],["socials",Object.freeze(new Map([["RSS Feed","https://aquati.cat/rss"],["Email","mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`Paragraph This is a paragraph. This is a paragraph with just a few more words and just a few more words and just a few more words and just a few more words. Images / Videos/Audios (function extension of this astro theme) ![alt text](sample-image.png) { /* TODO: This HTML output needs testing for a11y */ } <a href='./sample-image.png'>
  <picture>
    <source srcset='sample-image.avif' />
    <source srcset='sample-image.dark.avif' media='(prefers-color-scheme: dark)' />
    <img src='sample-image.avif' alt=`],["tags",Object.freeze(["guide"])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","Using MDX"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var only_en_ca_default=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/post"],["name","only-en-ca"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/post/only-en-ca"],["defaultLang","en"],["description","Personal Blog SSG and Theme built with Vue 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashpostReplacedSlashonlyReplacedHyphenenReplacedHyphencaReplacedDottoml"],["frontmatterPath","subtle/post/only-en-ca.toml"],["fullTitle","en of only en and ca | Subtle"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/post/only-en-ca.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/post/only-en-ca"],["isHome",!1],["isLinks",!1],["is404",!1],["isPost",!0],["lang","en"],["latest",new Date("2024-05-19T07:33:58.225Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`en of only en and ca
`],["postImportName","subtleReplacedSlashpostReplacedSlashonlyReplacedHyphenenReplacedHyphencaReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle"],["slashSiteBaseWLangWSlash","/subtle/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","Subtle"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/post/only-en-ca.html"],["slugWIndexWoExt","subtle/post/only-en-ca"],["slug","subtle/post/only-en-ca"],["socials",Object.freeze(new Map([["RSS Feed","https://aquati.cat/rss"],["Email","mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary","en of only en and ca"],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","en of only en and ca"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var __default4=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/zh-CN"],["name","404"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/zh-CN/404"],["defaultLang","en"],["description","以 Vue 构建的个人博客生成器 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashzhReplacedHyphenCNReplacedSlash404ReplacedDottoml"],["frontmatterPath","subtle/zh-CN/404.toml"],["fullTitle","404 | 微妙"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/zh-CN/404.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/zh-CN/404"],["isHome",!1],["isLinks",!1],["is404",!0],["isPost",!1],["lang","zh-CN"],["latest",new Date("2024-05-19T07:33:58.224Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`<p
lang='zh'
data-id='404'>
未知领域
</p>

<p
lang='en'
data-id='404'>
You've landed on an unknown page.
</p>

<p
hidden
lang='en'
data-id='tempUnavailable'>
Sorry, this page is not available in your language yet. Please check back later.
</p>
<p
hidden
lang='zh'
data-id='tempUnavailable'>
抱歉，此页暂时无所选语言的版本，请稍后再看。
</p>

<p
hidden
lang='en'
data-id='unsupported'>
Sorry, this site is not available in your language.
</p>
<p
hidden
lang='zh'
data-id='unsupported'>
抱歉，此网站不支持所选语言。
</p>
`],["postImportName","subtleReplacedSlashzhReplacedHyphenCNReplacedSlash404ReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/zh-CN"],["slashSiteBaseWLangWSlash","/subtle/zh-CN/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","微妙"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/zh-CN/404.html"],["slugWIndexWoExt","subtle/zh-CN/404"],["slug","subtle/zh-CN/404"],["socials",Object.freeze(new Map([["RSS ","https://aquati.cat/rss"],["邮箱","mailto:an@aquati.cat?subject=给 Monochromatic/Subtle 的作者发邮件"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`<p
lang='zh'
data-id='404'>
未知领域
</p> <p
lang='en'
data-id='404'>
You've landed on an unknown page.
</p> <p
hidden
lang='en'
data-id='tempUnavailable'>
Sorry, this page is not available in your language yet. Please check back later.
</p>
<p
hidden
lang='zh'
data-id='tempUnavailable'>
抱歉，此页暂时无所选语言的版本，请稍后再看。
</p> <p
hidden
lang='en'
data-id='unsupported'>
Sorry, this site is not available in your language.
</p>
<p
hidden
lang='zh'
data-id='unsupported'>
抱歉，此网站不支持所选语言。
</p>`],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","404"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var zh_CN_default=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/zh-CN"],["name","index"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/zh-CN"],["defaultLang","en"],["description","以 Vue 构建的个人博客生成器 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashzhReplacedHyphenCNReplacedSlashindexReplacedDottoml"],["frontmatterPath","subtle/zh-CN/index.toml"],["fullTitle","微妙"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/zh-CN/index.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/zh-CN/index"],["isHome",!0],["isLinks",!1],["is404",!1],["isPost",!1],["lang","zh-CN"],["latest",new Date("2024-05-19T07:33:58.223Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`不幸的是，我没能找到对于个人博客来说刚刚好的静态页面生成器主题。 需求只是有个地方放东西。

<section>
  不需要

  1.  页面套页面 -- 那对于文档站更适用。

  2.  炫酷 -- 又不是在卖东西

  3.  硬需求 JS -- 有人关掉

  4.  非系统字体 --

      挺好，但是没必要 未来可以加上它这个选项。
</section>
`],["postImportName","subtleReplacedSlashzhReplacedHyphenCNReplacedSlashindexReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/zh-CN"],["slashSiteBaseWLangWSlash","/subtle/zh-CN/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","微妙"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/zh-CN/index.html"],["slugWIndexWoExt","subtle/zh-CN/index"],["slug","subtle/zh-CN"],["socials",Object.freeze(new Map([["RSS ","https://aquati.cat/rss"],["邮箱","mailto:an@aquati.cat?subject=给 Monochromatic/Subtle 的作者发邮件"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`不幸的是，我没能找到对于个人博客来说刚刚好的静态页面生成器主题。 需求只是有个地方放东西。 <section>
  不需要 页面套页面 -- 那对于文档站更适用。 炫酷 -- 又不是在卖东西 硬需求 JS -- 有人关掉 非系统字体 --   挺好，但是没必要 未来可以加上它这个选项。</section>`],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","微妙"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var links_default4=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/zh-CN"],["name","links"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/zh-CN/links"],["defaultLang","en"],["description","以 Vue 构建的个人博客生成器 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashzhReplacedHyphenCNReplacedSlashlinksReplacedDottoml"],["frontmatterPath","subtle/zh-CN/links.toml"],["fullTitle","友链 | 微妙"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/zh-CN/links.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/zh-CN/links"],["isHome",!1],["isLinks",!0],["is404",!1],["isPost",!1],["lang","zh-CN"],["latest",new Date("2024-05-19T07:33:58.223Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`朋友们。
或者建议我做这个项目或者帮我做这个项目的。
`],["postImportName","subtleReplacedSlashzhReplacedHyphenCNReplacedSlashlinksReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/zh-CN"],["slashSiteBaseWLangWSlash","/subtle/zh-CN/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","微妙"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/zh-CN/links.html"],["slugWIndexWoExt","subtle/zh-CN/links"],["slug","subtle/zh-CN/links"],["socials",Object.freeze(new Map([["RSS ","https://aquati.cat/rss"],["邮箱","mailto:an@aquati.cat?subject=给 Monochromatic/Subtle 的作者发邮件"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`朋友们。
或者建议我做这个项目或者帮我做这个项目的。`],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","友链"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var __default5=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/zh-TW"],["name","404"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/zh-TW/404"],["defaultLang","en"],["description","以 Vue 构建的个人博客生成器 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashzhReplacedHyphenTWReplacedSlash404ReplacedDottoml"],["frontmatterPath","subtle/zh-TW/404.toml"],["fullTitle","404 | 微妙"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/zh-TW/404.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/zh-TW/404"],["isHome",!1],["isLinks",!1],["is404",!0],["isPost",!1],["lang","zh-TW"],["latest",new Date("2024-05-19T07:33:58.224Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`<p
lang='zh'
data-id='404'>
未知领域
</p>

<p
lang='en'
data-id='404'>
You've landed on an unknown page.
</p>

<p
hidden
lang='en'
data-id='tempUnavailable'>
Sorry, this page is not available in your language yet. Please check back later.
</p>
<p
hidden
lang='zh'
data-id='tempUnavailable'>
抱歉，此页暂时无所选语言的版本，请稍后再看。
</p>

<p
hidden
lang='en'
data-id='unsupported'>
Sorry, this site is not available in your language.
</p>
<p
hidden
lang='zh'
data-id='unsupported'>
抱歉，此网站不支持所选语言。
</p>
`],["postImportName","subtleReplacedSlashzhReplacedHyphenTWReplacedSlash404ReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/zh-TW"],["slashSiteBaseWLangWSlash","/subtle/zh-TW/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","微妙"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/zh-TW/404.html"],["slugWIndexWoExt","subtle/zh-TW/404"],["slug","subtle/zh-TW/404"],["socials",Object.freeze(new Map([["RSS ","https://aquati.cat/rss"],["邮箱","mailto:an@aquati.cat?subject=给 Monochromatic/Subtle 的作者发邮件"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`<p
lang='zh'
data-id='404'>
未知领域
</p> <p
lang='en'
data-id='404'>
You've landed on an unknown page.
</p> <p
hidden
lang='en'
data-id='tempUnavailable'>
Sorry, this page is not available in your language yet. Please check back later.
</p>
<p
hidden
lang='zh'
data-id='tempUnavailable'>
抱歉，此页暂时无所选语言的版本，请稍后再看。
</p> <p
hidden
lang='en'
data-id='unsupported'>
Sorry, this site is not available in your language.
</p>
<p
hidden
lang='zh'
data-id='unsupported'>
抱歉，此网站不支持所选语言。
</p>`],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","404"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var zh_TW_default=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/zh-TW"],["name","index"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/zh-TW"],["defaultLang","en"],["description","以 Vue 构建的个人博客生成器 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashzhReplacedHyphenTWReplacedSlashindexReplacedDottoml"],["frontmatterPath","subtle/zh-TW/index.toml"],["fullTitle","微妙"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/zh-TW/index.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/zh-TW/index"],["isHome",!0],["isLinks",!1],["is404",!1],["isPost",!1],["lang","zh-TW"],["latest",new Date("2024-05-19T07:33:58.224Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`不幸的是，我没能找到对于个人博客来说刚刚好的静态页面生成器主题。 需求只是有个地方放东西。

<section>
  不需要

  1.  页面套页面 -- 那对于文档站更适用。

  2.  炫酷 -- 又不是在卖东西

  3.  硬需求 JS -- 有人关掉

  4.  非系统字体 --

      挺好，但是没必要 未来可以加上它这个选项。
</section>
`],["postImportName","subtleReplacedSlashzhReplacedHyphenTWReplacedSlashindexReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/zh-TW"],["slashSiteBaseWLangWSlash","/subtle/zh-TW/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","微妙"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/zh-TW/index.html"],["slugWIndexWoExt","subtle/zh-TW/index"],["slug","subtle/zh-TW"],["socials",Object.freeze(new Map([["RSS ","https://aquati.cat/rss"],["邮箱","mailto:an@aquati.cat?subject=给 Monochromatic/Subtle 的作者发邮件"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`不幸的是，我没能找到对于个人博客来说刚刚好的静态页面生成器主题。 需求只是有个地方放东西。 <section>
  不需要 页面套页面 -- 那对于文档站更适用。 炫酷 -- 又不是在卖东西 硬需求 JS -- 有人关掉 非系统字体 --   挺好，但是没必要 未来可以加上它这个选项。</section>`],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","微妙"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var links_default5=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/zh-TW"],["name","links"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/zh-TW/links"],["defaultLang","en"],["description","以 Vue 构建的个人博客生成器 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashzhReplacedHyphenTWReplacedSlashlinksReplacedDottoml"],["frontmatterPath","subtle/zh-TW/links.toml"],["fullTitle","友链 | 微妙"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/zh-TW/links.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/zh-TW/links"],["isHome",!1],["isLinks",!0],["is404",!1],["isPost",!1],["lang","zh-TW"],["latest",new Date("2024-05-19T07:33:58.223Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`朋友们。
或者建议我做这个项目或者帮我做这个项目的。
`],["postImportName","subtleReplacedSlashzhReplacedHyphenTWReplacedSlashlinksReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/zh-TW"],["slashSiteBaseWLangWSlash","/subtle/zh-TW/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","微妙"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/zh-TW/links.html"],["slugWIndexWoExt","subtle/zh-TW/links"],["slug","subtle/zh-TW/links"],["socials",Object.freeze(new Map([["RSS ","https://aquati.cat/rss"],["邮箱","mailto:an@aquati.cat?subject=给 Monochromatic/Subtle 的作者发邮件"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`朋友们。
或者建议我做这个项目或者帮我做这个项目的。`],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","友链"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var only_ca_fr_default=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/ca/post"],["name","only-ca-fr"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/ca/post/only-ca-fr"],["defaultLang","en"],["description","Personal Blog SSG and Theme built with Vue 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashcaReplacedSlashpostReplacedSlashonlyReplacedHyphencaReplacedHyphenfrReplacedDottoml"],["frontmatterPath","subtle/ca/post/only-ca-fr.toml"],["fullTitle","ca of only ca and fr | Subtle"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/ca/post/only-ca-fr.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/ca/post/only-ca-fr"],["isHome",!1],["isLinks",!1],["is404",!1],["isPost",!0],["lang","ca"],["latest",new Date("2024-05-19T07:33:58.404Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`ca of only ca and fr
`],["postImportName","subtleReplacedSlashcaReplacedSlashpostReplacedSlashonlyReplacedHyphencaReplacedHyphenfrReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/ca"],["slashSiteBaseWLangWSlash","/subtle/ca/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","Subtle"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/ca/post/only-ca-fr.html"],["slugWIndexWoExt","subtle/ca/post/only-ca-fr"],["slug","subtle/ca/post/only-ca-fr"],["socials",Object.freeze(new Map([["RSS Feed","https://aquati.cat/rss"],["Email","mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary","ca of only ca and fr"],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","ca of only ca and fr"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var only_en_ca_default2=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/ca/post"],["name","only-en-ca"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/ca/post/only-en-ca"],["defaultLang","en"],["description","Personal Blog SSG and Theme built with Vue 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashcaReplacedSlashpostReplacedSlashonlyReplacedHyphenenReplacedHyphencaReplacedDottoml"],["frontmatterPath","subtle/ca/post/only-en-ca.toml"],["fullTitle","ca of only en and ca | Subtle"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/ca/post/only-en-ca.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/ca/post/only-en-ca"],["isHome",!1],["isLinks",!1],["is404",!1],["isPost",!0],["lang","ca"],["latest",new Date("2024-05-19T07:33:58.404Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`ca of only en and ca
`],["postImportName","subtleReplacedSlashcaReplacedSlashpostReplacedSlashonlyReplacedHyphenenReplacedHyphencaReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/ca"],["slashSiteBaseWLangWSlash","/subtle/ca/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","Subtle"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/ca/post/only-en-ca.html"],["slugWIndexWoExt","subtle/ca/post/only-en-ca"],["slug","subtle/ca/post/only-en-ca"],["socials",Object.freeze(new Map([["RSS Feed","https://aquati.cat/rss"],["Email","mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary","ca of only en and ca"],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","ca of only en and ca"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var only_ca_fr_default2=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/fr/post"],["name","only-ca-fr"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/fr/post/only-ca-fr"],["defaultLang","en"],["description","Personal Blog SSG and Theme built with Vue 🤔"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashfrReplacedSlashpostReplacedSlashonlyReplacedHyphencaReplacedHyphenfrReplacedDottoml"],["frontmatterPath","subtle/fr/post/only-ca-fr.toml"],["fullTitle","fr of only ca and fr | Subtle"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/fr/post/only-ca-fr.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/fr/post/only-ca-fr"],["isHome",!1],["isLinks",!1],["is404",!1],["isPost",!0],["lang","fr"],["latest",new Date("2024-05-19T07:33:58.404Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`fr of only ca and fr
`],["postImportName","subtleReplacedSlashfrReplacedSlashpostReplacedSlashonlyReplacedHyphencaReplacedHyphenfrReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/fr"],["slashSiteBaseWLangWSlash","/subtle/fr/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","Subtle"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/fr/post/only-ca-fr.html"],["slugWIndexWoExt","subtle/fr/post/only-ca-fr"],["slug","subtle/fr/post/only-ca-fr"],["socials",Object.freeze(new Map([["RSS Feed","https://aquati.cat/rss"],["Email","mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary","fr of only ca and fr"],["tags",Object.freeze([])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","fr of only ca and fr"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var mdx_default2=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/zh-CN/post"],["name","mdx"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/zh-CN/post/mdx"],["defaultLang","en"],["description","以下是在此 Astro 主题中编写 mdx 内容时可以使用的一些语法示例。"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashzhReplacedHyphenCNReplacedSlashpostReplacedSlashmdxReplacedDottoml"],["frontmatterPath","subtle/zh-CN/post/mdx.toml"],["fullTitle","用 MDX | 微妙"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/zh-CN/post/mdx.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/zh-CN/post/mdx"],["isHome",!1],["isLinks",!1],["is404",!1],["isPost",!0],["lang","zh-CN"],["latest",new Date("2024-05-19T07:33:58.404Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`## 段落

这是一段话。

这是一段只有几句话，还有几句话，只是还有几句话，只是还有几句话。

## 图片/视频/音频（本astro主题的功能扩展）

\`\`\`mdx
![替代文本](sample-image.png)
\`\`\`

\`\`\`html
<a href='./sample-image.png'>
   <picture>
     <source srcset='sample-image.avif' />
     <source srcset='sample-image.dark.avif' media='(prefers-color-scheme: dark)' />
     <img src='sample-image.avif' alt='替代文本' height='1024', width='1024' loading='lazy' />
   </picture>
</a>
\`\`\`


\`\`\`mdx
![sample-video.vtt](sample-video.mkv)
\`\`\`

\`\`\`html
<video controls preload='metadata'>
  <source src='sample-video.mkv' />
  <track
    src='sample-video.vtt'
    default />
</video>
\`\`\`

\`\`\`mdx
![sample-audio.vtt](sample-audio.opus)
\`\`\`

\`\`\`html
<video controls preload='metadata'>
  <source src='sample-audio.opus' />
  <track
    src='sample-audio.vtt'
    default />
</video>
\`\`\`

### 例

![favicon](/favicon.svg)

## Blockquotes

\`\`\`mdx
> 不要通过共享内存来通信，而是通过通信来共享内存。
>
> — <cite>罗布·派克</cite>
\`\`\`
> 不要通过共享内存来通信，而是通过通信来共享内存。
>
> — <cite>罗布·派克</cite>

## 表格

\`\`mdx
| 斜体| 粗体 | 代码 |
| ----- | -------- | ----- |
| _斜体_ | **粗体** | \`代码\` |
| _斜体_ | **粗体** | \`代码\` |
\`\`\`\`

| 斜体| 粗体 | 代码 |
| ----- | -------- | ----- |
| _斜体_ | **粗体** | \`代码\` |
| _斜体_ | **粗体** | \`代码\` |

## UML

\`\`\`uml
start
:你好世界;
:这是定义在
**多行**;
stop
\`\`\`

\`\`\`\`html
<a href='./你好世界.pu'>
  <picture>
    <source srcset='你好世界.svg' />
    <source srcset='你好世界.dark.svg' media='(prefers-color-scheme: dark)' />
    <img src='你好世界.svg' alt='start
:你好世界;
:这是定义在
多行**;
stop' height='1024', width='1024' loading='lazy' />
  </picture>
</a>
\`\`\`\`

## 列表

\`\`\`mdx
-   <p>水果</p>
    -   苹果
    -   橙子
    -   香蕉
    -   <p>乳制品</p>
        1. 牛奶
        2. 奶酪
\`\`\`

-   <p>水果</p>
    -   苹果
    -   橙子
    -   香蕉
    -   <p>乳制品</p>
        1. 牛奶
        2. 奶酪

## 其它 — abbr、sub、sup、kbd、mark、del

\`\`\`mdx
<abbr title='图形交换格式'>GIF</abbr> 是一种位图图像格式。

H<sub>2</sub>O X<sup>n</sup> + Y<sup>n</sup> = Z<sup>n</sup>

按 <kbd>CTRL</kbd> + <kbd>ALT</kbd> + <kbd>Delete</kbd> 结束会话。

大多数<mark>火蜥蜴</mark>都是夜间活动的，捕食昆虫、蠕虫和其他小生物。

~~删除线~~
\`\`\`

<abbr title='图形交换格式'>GIF</abbr> 是一种位图图像格式。

H<sub>2</sub>O X<sup>n</sup> + Y<sup>n</sup> = Z<sup>n</sup>

按 <kbd>CTRL</kbd> + <kbd>ALT</kbd> + <kbd>Delete</kbd> 结束会话。

大多数<mark>火蜥蜴</mark>都是夜间活动的，捕食昆虫、蠕虫和其他小生物。

~~删除线~~
`],["postImportName","subtleReplacedSlashzhReplacedHyphenCNReplacedSlashpostReplacedSlashmdxReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/zh-CN"],["slashSiteBaseWLangWSlash","/subtle/zh-CN/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","微妙"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/zh-CN/post/mdx.html"],["slugWIndexWoExt","subtle/zh-CN/post/mdx"],["slug","subtle/zh-CN/post/mdx"],["socials",Object.freeze(new Map([["RSS ","https://aquati.cat/rss"],["邮箱","mailto:an@aquati.cat?subject=给 Monochromatic/Subtle 的作者发邮件"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`段落 这是一段话。 这是一段只有几句话，还有几句话，只是还有几句话，只是还有几句话。 图片/视频/音频（本astro主题的功能扩展） ![替代文本](sample-image.png) <a href='./sample-image.png'>
   <picture>
     <source srcset='sample-image.avif' />
     <source srcset='sample-image.dark.avif' media='(prefers-color-scheme: dark)' />
     <img src='sample-image.avif' alt='替代文本' height='1024', width='1024' loading='lazy' />
   </picture>
</a> ![sample-video.vtt](sample-video.mkv) <video controls preload='metadata'>
  <source src='sample-video.mkv' />
  <track
    src='sample-vid`],["tags",Object.freeze(["guide"])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","用 MDX"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));var mdx_default3=Object.freeze(Object.fromEntries([["path",Object.freeze(Object.fromEntries([["dir","/workspaces/monochromatic2024MAR06/packages/theme/subtle/dist/temp/gen-html/subtle/zh-TW/post"],["name","mdx"]]))],["pkgJsonAbsPath","/workspaces/monochromatic2024MAR06/packages/theme/subtle"],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))],["canonicalUrl","https://monochromatic.dev/subtle/zh-TW/post/mdx"],["defaultLang","en"],["description","以下是在此 Astro 主题中编写 mdx 内容时可以使用的一些语法示例。"],["earliest",new Date("2024-03-06T00:00:00.000Z")],["frontmatterImportName","subtleReplacedSlashzhReplacedHyphenTWReplacedSlashpostReplacedSlashmdxReplacedDottoml"],["frontmatterPath","subtle/zh-TW/post/mdx.toml"],["fullTitle","用 MDX | 微妙"],["fullUrlWIndexWExt","https://monochromatic.dev/subtle/zh-TW/post/mdx.html"],["fullUrlWIndexWoExt","https://monochromatic.dev/subtle/zh-TW/post/mdx"],["isHome",!1],["isLinks",!1],["is404",!1],["isPost",!0],["lang","zh-TW"],["latest",new Date("2024-05-19T07:33:58.404Z")],["layoutImportName","subtleReplacedSlashindexReplacedDotvue"],["layoutPath","subtle/index.vue"],["license",Object.freeze(Object.fromEntries([["name","Creative Commons Attribution Share Alike 4.0 International"],["url","https://creativecommons.org/licenses/by-sa/4.0/legalcode"]]))],["links",Object.freeze(new Map([["Catoverflow","https://c-j.dev"],["dummy1","https://example.com"],["big dummy2","https://example.com"],["big big dummy1","https://example.com"],["big big dummy2","https://example.com"],["dummy3","https://example.com"],["dummy4","https://example.com"],["dummy5","https://example.com"],["dummy6","https://example.com"]]))],["mdxContent",`## 段落

這是一段話。

這是一段只有幾句話，還有幾句話，只是還有幾句話，只是還有幾句話。

## 圖片/影片/音訊（本astro主題的功能擴充）

\`\`\`mdx
![替代文字](sample-image.png)
\`\`\`

\`\`\`html
<a href='./sample-image.png'>
    <picture>
      <source srcset='sample-image.avif' />
      <source srcset='sample-image.dark.avif' media='(prefers-color-scheme: dark)' />
      <img src='sample-image.avif' alt='替代文字' height='1024', width='1024' loading='lazy' />
    </picture>
</a>
\`\`\`


\`\`\`mdx
![sample-video.vtt](sample-video.mkv)
\`\`\`

\`\`\`html
<video controls preload='metadata'>
   <source src='sample-video.mkv' />
   <track
     src='sample-video.vtt'
     default />
</video>
\`\`\`

\`\`\`mdx
![sample-audio.vtt](sample-audio.opus)
\`\`\`

\`\`\`html
<video controls preload='metadata'>
   <source src='sample-audio.opus' />
   <track
     src='sample-audio.vtt'
     default />
</video>
\`\`\`

### 例

![favicon](/favicon.svg)

## Blockquotes

\`\`\`mdx
> 不要透過共享記憶體來通信，而是透過通信來共享記憶體。
>
> — <cite>羅布·派克[^1]</cite>
\`\`\`
> 不要透過共享記憶體來通信，而是透過通信來共享記憶體。
>
> — <cite>羅布·派克</cite>

## 表格

\`\`mdx
| 斜體| 粗體 | 代碼 |
| ----- | -------- | ----- |
| _斜體_ | **粗體** | \`代碼\` |
| _斜體_ | **粗體** | \`代碼\` |
\`\`\`\`

| 斜體| 粗體 | 代碼 |
| ----- | -------- | ----- |
| _斜體_ | **粗體** | \`代碼\` |
| _斜體_ | **粗體** | \`代碼\` |

## UML

\`\`\`uml
start
:你好世界;
:這是定義在
**多行**;
stop
\`\`\`

\`\`\`\`html
<a href='./你好世界.pu'>
   <picture>
     <source srcset='你好世界.svg' />
     <source srcset='你好世界.dark.svg' media='(prefers-color-scheme: dark)' />
     <img src='你好世界.svg' alt='start
:你好世界;
:這是定義在
多行**;
stop' height='1024', width='1024' loading='lazy' />
   </picture>
</a>
\`\`\`\`

## 列表

\`\`\`mdx
- <p>水果</p>
     - 蘋果
     -   橘子
     - 香蕉
     - <p>乳製品</p>
         1. 牛奶
         2. 乳酪
\`\`\`

- <p>水果</p>
     - 蘋果
     -   橘子
     - 香蕉
     - <p>乳製品</p>
         1. 牛奶
         2. 乳酪

## 其它 — abbr、sub、sup、kbd、mark、del

\`\`\`mdx
<abbr title='圖形交換格式'>GIF</abbr> 是一種點陣圖影像格式。

H<sub>2</sub>O X<sup>n</sup> + Y<sup>n</sup> = Z<sup>n</sup>

按 <kbd>CTRL</kbd> + <kbd>ALT</kbd> + <kbd>Delete</kbd> 結束會話。

大多數<mark>蠑螈</mark>都是夜間活動的，捕食昆蟲、蠕蟲和其他小生物。

~~刪除線~~
\`\`\`

<abbr title='圖形交換格式'>GIF</abbr> 是一種點陣圖影像格式。

H<sub>2</sub>O X<sup>n</sup> + Y<sup>n</sup> = Z<sup>n</sup>

按 <kbd>CTRL</kbd> + <kbd>ALT</kbd> + <kbd>Delete</kbd> 結束會話。

大多數<mark>蠑螈</mark>都是夜間活動的，捕食昆蟲、蠕蟲和其他小生物。

~~刪除線~~
`],["postImportName","subtleReplacedSlashzhReplacedHyphenTWReplacedSlashpostReplacedSlashmdxReplacedDotmdx"],["published",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])],["slashSiteBase","/subtle"],["slashSiteBaseWSlash","/subtle/"],["slashSiteBaseWLang","/subtle/zh-TW"],["slashSiteBaseWLangWSlash","/subtle/zh-TW/"],["site","https://monochromatic.dev"],["siteBase","subtle"],["siteTitle","微妙"],["siteWithBase","https://monochromatic.dev/subtle"],["slugWIndexWExt","subtle/zh-TW/post/mdx.html"],["slugWIndexWoExt","subtle/zh-TW/post/mdx"],["slug","subtle/zh-TW/post/mdx"],["socials",Object.freeze(new Map([["RSS ","https://aquati.cat/rss"],["邮箱","mailto:an@aquati.cat?subject=给 Monochromatic/Subtle 的作者发邮件"],["GitHub","https://github.com/Aquaticat"],["Telegram","https://t.me/Aquaticat"]]))],["summary",`段落 這是一段話。 這是一段只有幾句話，還有幾句話，只是還有幾句話，只是還有幾句話。 圖片/影片/音訊（本astro主題的功能擴充） ![替代文字](sample-image.png) <a href='./sample-image.png'>
    <picture>
      <source srcset='sample-image.avif' />
      <source srcset='sample-image.dark.avif' media='(prefers-color-scheme: dark)' />
      <img src='sample-image.avif' alt='替代文字' height='1024', width='1024' loading='lazy' />
    </picture>
</a> ![sample-video.vtt](sample-video.mkv) <video controls preload='metadata'>
   <source src='sample-video.mkv' />
   <track
     src='sa`],["tags",Object.freeze(["guide"])],["theming",Object.freeze(Object.fromEntries([["color","#966783"]]))],["title","用 MDX"],["updated",Object.freeze([Object.freeze(Object.fromEntries([["date",new Date("2024-05-19T07:33:57.756Z")],["author",Object.freeze(Object.fromEntries([["name","Aquaticat"],["url","https://aquati.cat"]]))]]))])]]));import{getLogger,configure,getConsoleSink}from"@logtape/logtape";await configure({sinks:{console:getConsoleSink()},filters:{},loggers:[{category:["build","vue","app"],level:"debug",sinks:["console"]},{category:["logtape","meta"],level:"warning",sinks:["console"]}]});var l=getLogger(["build","vue","app"]),fms=[__default,subtle_default2,links_default,__default2,ca_default,links_default2,__default3,fr_default,links_default3,mdx_default,only_en_ca_default,__default4,zh_CN_default,links_default4,__default5,zh_TW_default,links_default5,only_ca_fr_default,only_en_ca_default2,only_ca_fr_default2,mdx_default2,mdx_default3],layouts=new Map([["subtleReplacedSlashindexReplacedDotvue",subtle_default]]),posts=new Map([["subtleReplacedSlash404ReplacedDotmdx",MDXContent],["subtleReplacedSlashindexReplacedDotmdx",MDXContent2],["subtleReplacedSlashlinksReplacedDotmdx",MDXContent3],["subtleReplacedSlashcaReplacedSlash404ReplacedDotmdx",MDXContent4],["subtleReplacedSlashcaReplacedSlashindexReplacedDotmdx",MDXContent5],["subtleReplacedSlashcaReplacedSlashlinksReplacedDotmdx",MDXContent6],["subtleReplacedSlashfrReplacedSlash404ReplacedDotmdx",MDXContent7],["subtleReplacedSlashfrReplacedSlashindexReplacedDotmdx",MDXContent8],["subtleReplacedSlashfrReplacedSlashlinksReplacedDotmdx",MDXContent9],["subtleReplacedSlashpostReplacedSlashmdxReplacedDotmdx",MDXContent10],["subtleReplacedSlashpostReplacedSlashonlyReplacedHyphenenReplacedHyphencaReplacedDotmdx",MDXContent11],["subtleReplacedSlashzhReplacedHyphenCNReplacedSlash404ReplacedDotmdx",MDXContent12],["subtleReplacedSlashzhReplacedHyphenCNReplacedSlashindexReplacedDotmdx",MDXContent13],["subtleReplacedSlashzhReplacedHyphenCNReplacedSlashlinksReplacedDotmdx",MDXContent14],["subtleReplacedSlashzhReplacedHyphenTWReplacedSlash404ReplacedDotmdx",MDXContent15],["subtleReplacedSlashzhReplacedHyphenTWReplacedSlashindexReplacedDotmdx",MDXContent16],["subtleReplacedSlashzhReplacedHyphenTWReplacedSlashlinksReplacedDotmdx",MDXContent17],["subtleReplacedSlashcaReplacedSlashpostReplacedSlashonlyReplacedHyphencaReplacedHyphenfrReplacedDotmdx",MDXContent18],["subtleReplacedSlashcaReplacedSlashpostReplacedSlashonlyReplacedHyphenenReplacedHyphencaReplacedDotmdx",MDXContent19],["subtleReplacedSlashfrReplacedSlashpostReplacedSlashonlyReplacedHyphencaReplacedHyphenfrReplacedDotmdx",MDXContent20],["subtleReplacedSlashzhReplacedHyphenCNReplacedSlashpostReplacedSlashmdxReplacedDotmdx",MDXContent21],["subtleReplacedSlashzhReplacedHyphenTWReplacedSlashpostReplacedSlashmdxReplacedDotmdx",MDXContent22]]),allLangs=Array.from(new Set(fms.map(potentialFmWUniqueLang=>potentialFmWUniqueLang.lang)));l.debug`allLangs ${allLangs}`;var postFms=fms.filter(potentialPostFm=>potentialPostFm.isPost);l.debug`postFms ${postFms.map(postFm=>({title:postFm.title,lang:postFm.lang}))}`;var postFmsMap=new Map(postFms.map(potentialNeeding404PostFm=>[potentialNeeding404PostFm,postFms.filter(postFm=>postFm.path.name===potentialNeeding404PostFm.path.name)]));l.debug`postFmsMap ${new Map(Array.from(postFmsMap).map(([postFm,postFmMatches])=>[{title:postFm.title,lang:postFm.lang},postFmMatches.map(postFmMatch=>({title:postFmMatch.title,lang:postFmMatch.lang}))]))}`;var post404Map=Array.from(postFmsMap).map(([postFm,postFmMatches])=>[postFm,allLangs.filter(lang=>!postFmMatches.map(postFmMatch=>postFmMatch.lang).includes(lang))]);l.debug`post404Map ${new Map(Array.from(post404Map).map(([post404FromFm,post404Langs])=>[{title:post404FromFm.title,lang:post404FromFm.lang},post404Langs]))}`;var post404Fms=uniqWith((x,y)=>x.slugWIndexWExt===y.slugWIndexWExt,Array.from(post404Map).flatMap(([postFm,postFm404Langs])=>postFm404Langs.map(postFm404Lang=>({...postFm,is404:!0,lang:postFm404Lang,slugWIndexWExt:postFm.lang!==postFm.defaultLang?postFm404Lang!==postFm.defaultLang?postFm.slugWIndexWExt.replace(`/${postFm.lang}/`,`/${postFm404Lang}/`):postFm.slugWIndexWExt.replace(`/${postFm.lang}/`,"/"):postFm.siteBase?`${postFm.siteBase}/${postFm404Lang}${postFm.slugWIndexWExt.slice(postFm.siteBase.length)}`:`${postFm404Lang}/${postFm.slugWIndexWExt}`}))));l.debug`post404Fms ${post404Fms.map(post404Fm=>({title:post404Fm.title,lang:post404Fm.lang,slugWIndexWExt:post404Fm.slugWIndexWExt}))}`;var htmlTemplate=__name((fm,html)=>`
<!DOCTYPE html>
<html lang='${fm.lang}'>
<head>
<meta charset='utf-8' />
<meta name='viewport' content='width=device-width,initial-scale=1' />
<link href='${fm.slashSiteBase}/index.css' rel='preload' as='style'>
<title>${fm.fullTitle}</title>
<link href='${fm.slashSiteBase}/index.css' blocking='render' rel='stylesheet'>
<link rel='icon' href='${fm.slashSiteBase}/favicon.ico' sizes='32x32'>
<link rel='icon' type='image/svg+xml' href='${fm.slashSiteBase}/favicon.svg'>
<link rel='apple-touch-icon' href='${fm.slashSiteBase}/apple-touch-icon.png'>
<script src='${fm.slashSiteBase}/index.js' async type='module'></script>
<meta name='title' content='${fm.title}' />
<meta name='description' content='${fm.description}' />
<meta name='theme-color' content='${fm.theming.color}' />
<meta name='keywords' content='${fm.tags.join(" ")}' />
<link rel='canonical' href='${fm.canonicalUrl}'/>
${fm.is404?"<meta http-equiv='response' content='404'>":""}
${fms.filter(potentialMatchingFm=>potentialMatchingFm.path.name===fm.path.name).map(matchingFm=>`<link rel='alternate' href='/${matchingFm.slug}' hreflang='${matchingFm.lang}' />`).join(`
`)}
</head>
<body>
  ${html}
</body>
</html>
`,"htmlTemplate"),result=await Promise.all([__name(async function(){return await mapParallelAsync(async fm=>{let app=createSSRApp({components:{Layout:layouts.get(fm.layoutImportName),Post:posts.get(fm.postImportName)},template:`
          <Layout>
            <Post></Post>
          </Layout>
          `});app.provide("frontmatter",fm),app.provide("frontmatters",fms);let html=await renderToString(app);return await fs.outputFile(path.join("dist","temp","html",fm.slugWIndexWExt),htmlTemplate(fm,html))},fms)},"genNormal")(),__name(async function(){return await mapParallelAsync(async fm=>{let app=createSSRApp({components:{Layout:layouts.get(fm.layoutImportName)},template:`
          <Layout>
          </Layout>
          `});app.provide("frontmatter",fm),app.provide("frontmatters",fms);let html=await renderToString(app);return await fs.outputFile(path.join("dist","temp","html",fm.slugWIndexWExt),htmlTemplate(fm,html))},post404Fms)},"gen404")(),fs.outputFile(path.join("dist","temp","html","post404Fms.json"),JSON.stringify(post404Fms,null,2))]);l.debug`${result}`;
