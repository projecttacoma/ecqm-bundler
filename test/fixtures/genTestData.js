"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const translator_1 = require("../../src/helpers/translator");
const TRANSLATOR_URL = 'http://localhost:8080/cql/translator';
const simpleLibraryCQL = path_1.default.join(__dirname, './SimpleLibrary.cql');
const simpleLibraryDependencyCQL = path_1.default.join(__dirname, './SimpleLibraryDependency.cql');
(0, translator_1.getELM)([simpleLibraryCQL, simpleLibraryDependencyCQL], TRANSLATOR_URL)
    .then(elm => {
    elm.forEach(lib => {
        const p = path_1.default.join(__dirname, `./${lib.library.identifier.id}.json`);
        fs_1.default.writeFileSync(p, JSON.stringify(lib, null, 2), 'utf8');
        console.log(`Wrote ELM JSON to ${p}`);
    });
})
    .catch(e => {
    console.error(`Error generating test data: ${e.message}`);
});
