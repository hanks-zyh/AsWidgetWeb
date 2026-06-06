#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");
const { parseSVG } = require("svg-path-parser");
const OUT_DIR = '/Users/hanks/work/opensource/AsWidget/app/src/main/java/com/automan/widget/aswidget/ui/icons/'

function upperFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function lowerFirst(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
}

function f(v) {
    return `${Number(v).toFixed(1)}f`;
}

function transformY(y, minY) {
    return y - minY;
}

function parseViewBox(svgAttrs) {
    const viewBox = svgAttrs.viewBox;

    if (!viewBox) {
        throw new Error("SVG missing viewBox");
    }

    const values = viewBox
        .trim()
        .split(/\s+/)
        .map(Number);

    if (values.length !== 4) {
        throw new Error(`Invalid viewBox: ${viewBox}`);
    }

    return {
        minX: values[0],
        minY: values[1],
        viewportWidth: values[2],
        viewportHeight: values[3]
    };
}

function pathToCompose(d, minY) {
    const commands = parseSVG(d);

    const lines = [];

    const emit = (code) => {
        lines.push(`                ${code}`);
    };

    for (const cmd of commands) {
        switch (cmd.code) {

            case "M":
                emit(
                    `moveTo(${f(cmd.x)}, ${f(transformY(cmd.y, minY))})`
                );
                break;

            case "m":
                emit(
                    `moveToRelative(${f(cmd.x)}, ${f(cmd.y)})`
                );
                break;

            case "L":
                emit(
                    `lineTo(${f(cmd.x)}, ${f(transformY(cmd.y, minY))})`
                );
                break;

            case "l":
                emit(
                    `lineToRelative(${f(cmd.x)}, ${f(cmd.y)})`
                );
                break;

            case "H":
                emit(`horizontalLineTo(${f(cmd.x)})`);
                break;

            case "h":
                emit(`horizontalLineToRelative(${f(cmd.x)})`);
                break;

            case "V":
                emit(
                    `verticalLineTo(${f(transformY(cmd.y, minY))})`
                );
                break;

            case "v":
                emit(
                    `verticalLineToRelative(${f(cmd.y)})`
                );
                break;

            case "C":
                emit(
                    `curveTo(
                    ${f(cmd.x1)}, ${f(transformY(cmd.y1, minY))},
                    ${f(cmd.x2)}, ${f(transformY(cmd.y2, minY))},
                    ${f(cmd.x)}, ${f(transformY(cmd.y, minY))}
                )`
                );
                break;

            case "c":
                emit(
                    `curveToRelative(
                    ${f(cmd.x1)}, ${f(cmd.y1)},
                    ${f(cmd.x2)}, ${f(cmd.y2)},
                    ${f(cmd.x)}, ${f(cmd.y)}
                )`
                );
                break;

            case "S":
                emit(
                    `reflectiveCurveTo(
                    ${f(cmd.x2)}, ${f(transformY(cmd.y2, minY))},
                    ${f(cmd.x)}, ${f(transformY(cmd.y, minY))}
                )`
                );
                break;

            case "s":
                emit(
                    `reflectiveCurveToRelative(
                    ${f(cmd.x2)}, ${f(cmd.y2)},
                    ${f(cmd.x)}, ${f(cmd.y)}
                )`
                );
                break;

            case "Q":
                emit(
                    `quadraticBezierTo(
                    ${f(cmd.x1)}, ${f(transformY(cmd.y1, minY))},
                    ${f(cmd.x)}, ${f(transformY(cmd.y, minY))}
                )`
                );
                break;

            case "q":
                emit(
                    `quadraticBezierToRelative(
                    ${f(cmd.x1)}, ${f(cmd.y1)},
                    ${f(cmd.x)}, ${f(cmd.y)}
                )`
                );
                break;

            case "T":
                emit(
                    `reflectiveQuadraticBezierTo(
                    ${f(cmd.x)},
                    ${f(transformY(cmd.y, minY))}
                )`
                );
                break;

            case "t":
                emit(
                    `reflectiveQuadraticBezierToRelative(
                    ${f(cmd.x)},
                    ${f(cmd.y)}
                )`
                );
                break;

            case "Z":
            case "z":
                emit("close()");
                break;

            case "A":
            case "a":
                throw new Error(
                    `Arc command '${cmd.code}' not supported yet`
                );

            default:
                console.warn(
                    `Unsupported command: ${cmd.code}`
                );
        }
    }

    return lines.join("\n");
}

function generateKotlin({
    iconName,
    viewportWidth,
    viewportHeight,
    paths
}) {
    const className = upperFirst(iconName);
    const fieldName = lowerFirst(iconName);

    return `
package com.automan.widget.aswidget.ui.icons

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

public val ${className}: ImageVector
    get() {
        if (_${fieldName} != null) {
            return _${fieldName}!!
        }

        _${fieldName} =
            ImageVector.Builder(
                name = "${className}",
                defaultWidth = 24.dp,
                defaultHeight = 24.dp,
                viewportWidth = ${viewportWidth}f,
                viewportHeight = ${viewportHeight}f
            ).apply {

${paths}

            }.build()

        return _${fieldName}!!
    }

private var _${fieldName}: ImageVector? = null
`.trim();
}

async function convert(iconName, svgContent) {

    const xml = await xml2js.parseStringPromise(svgContent);

    const svg = xml.svg;

    const {
        minY,
        viewportWidth,
        viewportHeight
    } = parseViewBox(svg.$);

    const pathNodes = svg.path || [];

    if (!pathNodes.length) {
        throw new Error("No path found");
    }

    const composePaths = pathNodes.map(node => {

        const d = node.$.d;

        const pathContent =
            pathToCompose(d, minY);

        return `
                path(
                    fill = SolidColor(Color.Black),
                    pathFillType = PathFillType.NonZero
                ) {
${pathContent}
                }
`;
    });

    return generateKotlin({
        iconName,
        viewportWidth,
        viewportHeight,
        paths: composePaths.join("\n")
    });
}

async function main() {

    const [, , iconName, input] = process.argv;

    if (!iconName || !input) {
        console.log(
            "Usage: node svg-to-compose.js IconName <svg-file-or-svg-content>"
        );
        process.exit(1);
    }

    let svgContent;

    if (fs.existsSync(input)) {
        svgContent =
            fs.readFileSync(input, "utf8");
    } else {
        svgContent = input;
    }

    const kotlin =
        await convert(iconName, svgContent);

    const outputDir =
        path.resolve(OUT_DIR);

    fs.mkdirSync(outputDir, {
        recursive: true
    });

    const outputFile =
        path.join(
            outputDir,
            `${upperFirst(iconName)}.kt`
        );

    fs.writeFileSync(
        outputFile,
        kotlin,
        "utf8"
    );

    console.log(
        `Generated: ${outputFile}`
    );
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});