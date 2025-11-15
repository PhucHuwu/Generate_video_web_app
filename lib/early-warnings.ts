// Early warning filter: suppress DEP0169 deprecation warnings from dependencies (cloudinary uses url.parse internally)
// We register this as a top-level import in routes that use cloudinary so the handler is attached before the dependency is loaded.

if (typeof process !== "undefined" && process && typeof process.on === "function") {
    process.on("warning", (warning: any) => {
        try {
            if (
                warning &&
                warning.name === "DeprecationWarning" &&
                // Node deprecation code for url.parse: DEP0169
                (warning.code === "DEP0169" || (warning.message && warning.message.includes("url.parse()")))
            ) {
                // ignore this specific deprecation warning to avoid noisy logs
                return;
            }
        } catch (e) {
            // fall through to default logging
        }
        // For anything else, output as normal
        // eslint-disable-next-line no-console
        console.warn(warning);
    });
}
