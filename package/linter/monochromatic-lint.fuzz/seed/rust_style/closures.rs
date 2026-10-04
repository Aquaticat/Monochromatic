fn named(value: u16) -> u16 { return value; }
fn main() {
    call(named);
    let callback = move |value: u16| -> u16 { return value; };
    call(|| || 1);
    let future = async { return 1; };
}
