// NodeJsSecurify, a typescript based npm package to secure your nodejs 
// application code according to OWASP guidelines and check for best 
// practices.
// It provide security against :
// => "Input Validation",
// => "Dangerous Functions",
// => "DOS Attack",
// => "ReGex DOS Attack",
// => "Brute Force Attack",
// => "OWASP",
// => "CallBack Hell",
// => "XSS Attack",
// => "Insecure Security Headers",
// => "Unsafe npm packages",
// => "Insecure Authentication",
// => "Code Injection",

import * as esprima from 'esprima';
import * as fs from "fs";
import * as path from 'path';
import * as colors from 'colors';
import * as util from 'util';
import { detectBruteForce } from './Vulnerability/DetectBruteForceAttack'
import { detectCallBackHell } from './Vulnerability/DetectCallBackHell';
import { isRegexVulnerable } from './Vulnerability/DetectVulnerableRegex';
import { detectInputValidation } from './Vulnerability/DetectInputValidation';
import { detectDangerousFunctions } from './Vulnerability/DetectDangerousFunctions';
import {analyzeSecurityHeaders} from './Vulnerability/AnalyzeSecurityHeaders';
import { insecureAuthentication } from './Vulnerability/InsecureAuthentication';
import {checkVulnerablePackages} from './Vulnerability/DetectUnsafeNpmPackage';
import {generatePDFReport} from './GenerateReport';

const colours = colors;
// there are two modes DEV and PROD.
// switch to DEV mode while testing and PROD mode while pushing the code
const mode: String = 'PROD';
if (mode === 'DEV'){
    // update this path depending on the path of TestFolder according to your system
    __dirname = "F:/NodeSecurify/TestFolder";
}

export class Log {

    static async NodeJsSecurifyResults() {
        function extractParentPath(inputPath: string) {
            // Find the last occurrence of "node_modules" in the input path
            const lastIndex = inputPath.lastIndexOf("node_modules");
            if (lastIndex !== -1) {
                // Extract the part of the path up to the last occurrence of "node_modules"
                let outputPath = inputPath.slice(0, lastIndex);
                // Remove any trailing backslashes if present
                if (outputPath.endsWith("\\")) {
                    outputPath = outputPath.slice(0, -1);
                }
                return outputPath;
            }
            // If "node_modules" is not found, return the input path as it is
            return inputPath;
        }
        const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');
        try {
            const logFile = fs.createWriteStream(__dirname+'/NodeJsSecurityReport.log', { flags: 'w' });
            const logStdout = process.stdout;

            console.log = function () {
                let message = util.format.apply(null, Array.from(arguments));
                // Write the stripped message to the log file (no ANSI colors)
                logFile.write(stripAnsi(message) + '\n');
                // Write the colored message to the terminal
                logStdout.write(message + '\n');
            };
            
            console.error = function () {
                const message = util.format.apply(null, Array.from(arguments));
                // Write the stripped message to the log file (no ANSI colors)
                logFile.write(message + '\n');
                // Write the colored message to the terminal
                logStdout.write(message + '\n');
            };

            __dirname = extractParentPath(__dirname);

            console.log("\n******************************************************************************************".green);
            console.log("****************************** Node-Js-Securify STARTED ***************************".green);
            console.log("******************************************************************************************".green);


            console.log('\nSearching for .js files in (root directory) : '.yellow + __dirname.rainbow);

            // concat all the results from gitignore files
            let gitIgnoreFiles: string = Log.findGitIgnoreFiles(__dirname);

            let gitIgnoreFilesArray: string[] = gitIgnoreFiles.split('\n');
            console.log("\nFile names in .gitignore files not getting parsed: \n".yellow);

            // including node_modules in gitIgnoreFilesArray
            gitIgnoreFilesArray.push('node_modules');
            const arrayString = gitIgnoreFilesArray.join(", ");
            console.log(arrayString.cyan);

            // parsing all the .js & .jsx files, except files in gitIgnoreFilesArray
            console.log("\nFile path name of .js & .jsx files getting parsed: \n".yellow);
            Log.parseJSFiles(__dirname, gitIgnoreFilesArray);

            // parsing for vulnerable npm pacakage
            console.log("Parsing for vulnerable npm pacakage (check NodeJsSecurifyReport.log in root dir)".blue);
            checkVulnerablePackages(__dirname, logFile.path)
            .then(() => {
                    // Once the audit completes, call generatePDFReport
                    generatePDFReport(__dirname, logFile.path);
                })
                .catch((error) => {
                });
            logFile.end();
        }
        catch (error: any) {
            console.log("Error parsing file".underline.red);
            console.log("Please resolve error in file (check last file path) before running NodeJsSecurify".underline.red);
            console.error(error);
        }
    }

    // traversing all the gitignore files and including all the file names 
    // not be parsed in gitIgnoreFiles string
    static findGitIgnoreFiles(directory: string) {
        let gitIgnoreFiles: string = "";

        function traverseDirectory(dir: any) {
            const files = fs.readdirSync(dir);

            files.forEach(file => {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);

                if (stat.isDirectory()) {
                    // Recursively traverse subdirectories
                    traverseDirectory(filePath);
                } else if (file === '.gitignore') {
                    const fileContent: string = fs?.readFileSync(filePath, 'utf8');
                    gitIgnoreFiles += (fileContent);
                }
            });
        }

        traverseDirectory(directory);
        gitIgnoreFiles += ("\nVulnerability\ndist\nNodeJsSecurify.js");
        return gitIgnoreFiles;
    }

    // Recursively traverse all the files in given directory path.
    // Ensure it does the same when installed by anyone in any directory of their system.
    // So make such changes to ensure the former. 
    static async parseJSFiles(directory: string, gitIgnoreFilesArray: string[]) {

        try {
            let files: string[] = fs.readdirSync(directory);
            files = files.filter(function (e) {
                return gitIgnoreFilesArray.indexOf(e) === -1;
            });

            for (const file of files) {

                const filePath: string = path.join(directory, file);
                const stat: fs.Stats = fs?.statSync(filePath);
                const fileLastName: string = path.extname(filePath);

                if (stat.isDirectory()) {
                    // Recursively parse files in subdirectories
                    Log.parseJSFiles(filePath, gitIgnoreFilesArray);
                }
                else if (fileLastName === '.js' || fileLastName === '.jsx' || fileLastName === '.tsx' || fileLastName === '.ts') {
                    try {
                        console.log(filePath.blue);
                        const fileContent: string = fs?.readFileSync(filePath, 'utf8');

                        // Parse the file content using the esprima parser
                        const jsonAst: esprima.Program = esprima?.parseScript(fileContent, { loc: true, comment: true, tokens: true, tolerant: true, jsx: true });
                        const strAst: string = JSON.stringify(jsonAst, null, 1);

                        // Write data in 'name_of_file_being_parsed.json'.
                        fs?.writeFile(`./EsprimaOutput/${file}.json`, strAst, (err: any): any => {
                            // if (err) throw err;
                        });

                        detectCallBackHell(jsonAst, 0, file);
                        console.log("\n");
                        detectBruteForce(fileContent);
                        console.log("\n");
                        isRegexVulnerable(jsonAst);
                        console.log("\n");
                        detectInputValidation(fileContent);
                        console.log("\n");
                        detectDangerousFunctions(jsonAst, fileContent);
                        console.log("\n");
                        insecureAuthentication(fileContent);
                        console.log("\n");
                        analyzeSecurityHeaders(fileContent);
                        console.log("\n");
                    } catch (error) {
                        console.log(error)
                        continue;
                    }
                }
            }
        } catch (error) {
            return null;
        }

    }
}

Log.NodeJsSecurifyResults();