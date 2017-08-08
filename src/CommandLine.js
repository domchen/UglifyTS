"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionDeclarations = [
    {
        name: "help",
        shortName: "h",
        type: "boolean",
        description: "Print help message."
    },
    {
        name: "project",
        shortName: "p",
        type: "string",
        description: "Obfuscate the source files in the given directory."
    },
    {
        name: "version",
        shortName: "v",
        type: "boolean",
        description: "Print UglifyTS’s version."
    }
];
var optionNameMapCache;
function getOptionNameMap() {
    if (optionNameMapCache) {
        return optionNameMapCache;
    }
    var optionNameMap = {};
    var shortOptionNames = {};
    exports.optionDeclarations.forEach(function (option) {
        optionNameMap[option.name.toLowerCase()] = option;
        if (option.shortName) {
            shortOptionNames[option.shortName] = option.name;
        }
    });
    optionNameMapCache = { optionNameMap: optionNameMap, shortOptionNames: shortOptionNames };
    return optionNameMapCache;
}
function parse(args) {
    var options = {};
    options.errors = [];
    var _a = getOptionNameMap(), optionNameMap = _a.optionNameMap, shortOptionNames = _a.shortOptionNames;
    var i = 0;
    while (i < args.length) {
        var s = args[i];
        i++;
        if (s.charAt(0) == "-") {
            s = s.slice(s.charAt(1) == "-" ? 2 : 1).toLowerCase();
            if (s in shortOptionNames) {
                s = shortOptionNames[s];
            }
            if (s in optionNameMap) {
                var opt = optionNameMap[s];
                if (!args[i] && opt.type !== "boolean") {
                    options.errors.push("Option '" + opt.name + "' expects an argument.");
                }
                switch (opt.type) {
                    case "number":
                        options[opt.name] = parseInt(args[i]);
                        i++;
                        break;
                    case "boolean":
                        options[opt.name] = true;
                        break;
                    case "string":
                        options[opt.name] = args[i] || "";
                        i++;
                        break;
                }
            }
            else {
                options.errors.push("Unknown option '" + s + "'.");
            }
        }
        else {
            options.outDir = s;
        }
    }
    if (!options.outDir) {
        options.outDir = "generated";
    }
    return options;
}
exports.parse = parse;
