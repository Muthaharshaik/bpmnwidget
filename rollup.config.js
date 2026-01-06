import { join } from "path";

export default args => {
    const result = args.configDefaultConfig;
    
    // Add inlineDynamicImports to handle jsPDF and other libraries with dynamic imports
    result.forEach(config => {
        if (config.output) {
            config.output.inlineDynamicImports = true;
        }
    });
    
    return result;
};