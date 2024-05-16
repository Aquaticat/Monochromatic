declare const _default: import("vue").DefineComponent<__VLS_TypePropsToOption<{
    date: Date;
}>, {}, unknown, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<__VLS_TypePropsToOption<{
    date: Date;
}>>>, {}, {}>;
export default _default;
type __VLS_TypePropsToOption<T> = {
    [K in keyof T]-?: {} extends Pick<T, K> ? {
        type: import('vue').PropType<T[K]>;
    } : {
        type: import('vue').PropType<T[K]>;
        required: true;
    };
};
