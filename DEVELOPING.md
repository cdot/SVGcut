# DEVELOPING

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

`index.html` loads `js/app.js` which is a simple stub that just instantiates
`App.js`, the main application singleton. This in turn creates all the view models, one for each pane in the display. Some panes (Operations, Tabs) have sub-view models for items dynamically created in those panes.

The display of imported SVG is handled in an SVG-enabled canvas, making use of `snapsvg` to manipulate the SVG DOM.

The simulation is done in a canvas using WebGL. See `js/Simulation.js`.

## Selection
When an SVG file is loaded, it is added to the DOM as written. That means all
complex path operations - such as circle, quadratic curves etc. - are retained
in the master drawing.

When the user clicks a path on the SVG picture, a new path is constructed that
uses only straight line segments. It is this copy that is added to the
Selection SVG. The copy is then converted to Clipper coordinates for toolpath
generation.

## Units
There are three coordinate systems at play.
- The first is "user" units, which are selectable using the "Units" dropdown. These are the units used to display measures to the user in all panes except Gcode Generation, which has it's own set of user units.
- When an SVG is imported, the units used in the SVG are automatically converted into "px" units by `snapsvg`, assuming a conversion of 96 pixels per inch.
- Once SVG import is complete, px units are converted to "integer" units. This conversion is a simple scaling, designed for use with ClipperLib which uses integer calculations for boolean and offset operations on polygons. Tool paths are internally represented using integer units.
- Finally integer units are mapped back to px units for generating SVG elements, and to whatever user units were requested for Gcode Generation.

Note that the conversion to Gcode units isn't as simple as the others, because px and integer units assume 0,0 at the top left with Y increasing downwards, but Gcode is generated assuming 0,0 at the lower left (or centre) with Y increasing upwards.

# Coding Standards
+ Literate coding. All names should be expressive of their purpose.
+ All files are named either for the class or namespace they define.
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
+ `observable.<type>` is used to document an knockout observable that observes a `type`.
+ Use `const` and `let`. Do not use `var`.
+ Use spaces around operators.
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
