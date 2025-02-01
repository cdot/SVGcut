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
One of these dependencies is `knockout`, and MVVM package that supports
association of HTML elements directly with code. Read their documentation
to understand how HTML elements link to the code.

`app.html` loads `js/app.js` which is a simple stub that just instantiates a
`SVGcut`, the main application singleton. This in turn creates all the view models, one for each pane in the display. Some panes (Operations, Tabs) have sub-view models for items dynamically created in those panes.

The display of SVG is handled in a single `<svg>` element. Groups within that
element are used for displaying different aspects - input SVG, computed
geometries, selection etc.

The simulation is done in a canvas using WebGL. See `js/Simulation.js`.

## Selection
When an SVG file is loaded, it is added to the DOM as written. That means all
complex path operations - such as circle, quadratic curves etc. - are retained
in the master drawing.

When the user clicks an object on the SVG picture, a new path is
constructed that approximates the object using only straight line
segments. It is this copy that is added to the Selection SVG. The copy
is then converted to integer coordinates for toolpath and Gcode generation.

## Units
There are four coordinate systems to understand.
- The first is "user" units, which are selectable using the "Units" dropdown. These are the units used to display measures to the user in all panes except Gcode Generation, which has it's own set of user units. `UnitConverter.js` does the work of converting between the different coordinate systems.
- When an SVG is imported, the units used in the SVG are automatically converted into "px" units, assuming a conversion of 96 pixels per inch. Most of the code for manipulating SVG is in SVG.js.
- Once SVG import is complete, px units are converted to "integer" units. This conversion is a simple scaling, designed for use with ClipperLib which uses integer calculations for boolean and offset operations on polygons. Paths in integer units are manipulated in `CutPath.js` and `CutPaths.js`.
- Finally integer units are mapped to whatever user units were requested for Gcode Generation in `Gcode.js`.

Note that the conversion to Gcode units isn't a simple scaling,
because px and integer units assume 0,0 at the top left with Y
increasing downwards, but Gcode is generated assuming 0,0 at the lower
left (or centre) with Y increasing upwards.

# Tests
There is a suite of unit tests in the `test` directory, implemented
using `mocha`. Run them using `npm run test`. They are far from
comprehensive, as most testing has been done interactively in the
browser.

# Coding Standards
+ Literate coding. All names should be expressive (in English) of their purpose.
+ One class/namespace per source file. Name files for the class or namespace they define.
+ Naming conventions
    + Use CamelCase for JS class and namespace names.
    + Use camelCase for JS method and function names.
    + Use UPPER_CASE for module-level and static consts.
    + Use dash-separated-names for CSS classes.
    + Use #CamelCase for DOM ids of major blocks (such as modals)
    + Use #camelCase for DOM cross-reference ids
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
SVGcut makes heavy use of third party libraries:
+ `knockout` is used to bind UI elements in the HTML to members in view models.
+ `bootstrap` is used to format the UI, and provides some widgets.
+ `snap` is used for manipulating SVG in the DOM.
+ `clipper` is used for polygon operations.
Authors of these libraries are acknowledged and thanked. Please avoid the use of any libraries that have overlapping functionality.

Also included in the dependencies is `2d-geometry`. This typeScript module from npm is compiled for node.js and doesn't work in the browser, so has had to be hacked locally to create `lib/2d-geometry`. It is functionally identical to the npm module, just uses browser-friendly import paths. Use of this library has enabled us to implement holding tabs in pure JS.
