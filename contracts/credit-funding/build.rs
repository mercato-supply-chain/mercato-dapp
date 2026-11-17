fn main() {
    // Shrink the WASM shadow stack from the 1 MiB Rust default.
    // Measured with wasm-stack-estimator on the release build: peak 864 B via
    // `contribute`, finite call graph. Proposed size is max(4096, next power of
    // two at or above 1.5x peak) = 4096. Native test binaries must not get this flag.
    let target = std::env::var("TARGET").unwrap_or_default();
    if target.starts_with("wasm32") {
        println!("cargo:rustc-link-arg=-zstack-size=4096");
    }
}
