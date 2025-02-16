# DEVELOPING

# Generating the Code Documentation
First, clone the repository. Then
```
npm install
npm run doc
```
You should be able to open `index.html` through a local web server.

# Overview of the code
`app.html` uses script tags to load most third-party dependencies.
One of these dependencies is [knockout](https://knockoutjs.com/), an
MVVM package that supports association of HTML elements directly with
code. Read their excellent documentation to understand how HTML
elements link to the code.

`app.html` loads `src/browser.js` which is a simple stub that just
instantiates a `SVGcut`, the main application singleton. This in turn
creates all the view models, one for each pane in the display. Some
panes (Operations, Tabs) have sub-view models for items dynamically
created in those panes.

The display of SVG is handled in a single `<svg>` element. Groups
within that element are used for displaying different aspects - input
SVG, computed geometries, selection etc.

The simulation is done in a canvas using WebGL. See `src/Simulation.js`.

## Flow of Control
When an SVG file is imported, it is added to the DOM as a child <svg> node.
All complex path operations - such as circle, quadratic curves, transformations
etc. - are retained in the `ContentSVGGroup`.

When the user clicks an object on the SVG picture, a new <path> is
constructed that approximates the object using only straight line
segments (`M`, `L` and `Z` commands only) using absolute pixel
coordinates. This copy is added to the `SelectionSVGGroup`.

When the user creates an operation (or holding tabs), these paths are
first converted to `CutPaths` objects using 2D `integer`
units. Integer units are used to maximise the accuracy of
`clipper-lib` operations, as the authors recommend.  These converted
paths are stored in the `OperationViewModel` (or `TabViewModel`) as
`operandPaths`.

The operand paths are then processed according to the selected
`combineOp` to produce `combinedGeometry` (the
`OperationViewModel.combineOp` only applies to closed paths;
`TabViewModel` always uses `Union` and only processes closed paths).

Focusing now on operations, the next stage in the pipeline is toolpath
generation. This applies the selection operation (such as
`AnnularPocket`) to the paths to generate the actual tool paths, splitting
them over holding tabs and assigning target Z coordinates as appropriate.
Tool paths are saved in the `OperationViewModel` as `toolPaths`.

The last step is Gcode generation. The paths are then
processed sequentially, with each path being cut in pass-depth passes
until the target Z for each segment of the path is reached.

The Gcode is then re-read to generate the simulation.

## Units
There are four coordinate systems to understand.
- The first is `user` units, which are selectable using the `Units` dropdown. These are the units used to display measures to the user in all panes except Gcode Generation, which has it's own set of user units. `UnitConverter.js` does the work of converting between the different coordinate systems.
- When an SVG is imported, the units used in the SVG are automatically converted into `px` units, assuming a conversion of 96 pixels per inch. Most of the code for manipulating SVG is in `SVG.js`.
- `px` units are converted internally to `integer` units. This conversion is a simple scaling, designed for use with `ClipperLib` which prefers integer calculations for boolean and offset operations on polygons.
- Finally integer units are mapped to whatever user units were requested for Gcode Generation in `Gcode.js`.

Note that the conversion to Gcode units isn't a simple scaling,
because `px` and `integer` units assume 0,0 at the top left with Y
increasing downwards, but Gcode is generated assuming 0,0 at the lower
left (or centre) with Y increasing upwards.

# Tests
There is a suite of unit tests in the `test` directory, implemented
using `mocha`. Run them using `npm run test`. They are far from
comprehensive, as most testing has been done interactively in the
browser. Note that some of the tests have to be run with the `--experimental-loader` switch e.g.
```
mocha --experimental-loader=@node-loader/import-maps SVG.js
```

# Coding Standards
+ Literate coding. All names should be expressive (in English) of their purpose.
+ One class/namespace per source file. Name files for the class or namespace they define.
+ Naming conventions
    + Use CamelCase for JS class and namespace names.
    + Use camelCase for JS method and function names.
    + Use UPPER_CASE for module-level and static consts.
    + Use dash-separated-names for CSS classes.
    + Use #CamelCase for DOM ids
+ The use of JS global variables is strongly discouraged. Most "globals" can be encapsulated in the `App` singleton if necessary.
+ 2-space indentation in JS and HTML.
+ Prefer object-oriented code using ES6 syntax.
+ All methods, functions, and members must be documented using JSDoc.
+ `observable.<type>` is used to document an `knockout` observable that observes a `type`.
+ Use `const` and `let`. Do not use `var`.
+ Use spaces around operators and inside square brackets.
+ Keep `npm run lint` clean.
+ Use `npm run doc` to generate and check code documentation.

## Third-party Libraries
Dependencies are minimised as far as possible, but SVGcut still makes
heavy use of third party libraries:
+ `knockout` is used to bind UI elements in the HTML to members in view models.
+ `bootstrap` is used to format the UI, and provides some widgets.
+ `flatten-js` has enabled us to implement holding tabs in pure Javascript.
+ `clipper-lib` is used for polygon operations.
Authors of these libraries are acknowledged and thanked.
