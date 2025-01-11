# DEVELOPING

First, clone the repository. Then
```
npm install
npm run doc
```
You should be able to open `index.html` through a local web server.

# Overview of the code
`index.html` uses script tags to load most third-party dependencies.
One of these dependencies is `knockout`, and MVVM package that supports
association of HTML elements directly with code. Read their documentation
to understand how HTML elements link to the code.

`index.html` loads `js/app.js` which is a simple stub that just instantiates
`App.js`, the main application singleton. This in turn creates all the view models, one for each pane in the display. Some panes (Operations, Tabs) have sub-view models for items dynamically created in those panes.

The display of imported SVG is handled in an SVG-enabled canvas, making use of `snapsvg` to manipulate the SVG DOM.

The simulation is done in a canvas using WebGL. See `js/Simulation.js`.

## Units
There are three unit systems at play.
- The first is "user" units, which are selectable using the "Units" dropdown. These are the units used to display measures to the user in all panes except Gcode Generation, which has it's own set of user units.
- When an SVG is imported, the units used in the SVG are automatically converted into "px" units by `snapsvg`, assuming a conversion of 96 pixels per inch.
- Once SVG manipulation is complete, px units are converted to "internal" units. This conversion is designed to help reduce rounding errors in floating point calculations performed on polygons. Tool paths are internally represented using internal units.
- Finally internal units are mapped back to px units for generating SVG elements, and to whatever physical units were requested for Gcode Generation.

Note that the conversion to Gcode isn't as simple as the others, because px and internal units assume 0,0 at the top left with Y incresing downwards, but Gcode is generated assuming 0,0 at the lower left with Y increasing upwards.

# Coding Standards
+ All files are named either for the class or namespace they define.
+ The use of global variables is strongly discouraged.
+ 2-space indentation
+ Literate coding. All names should be expressive of their purpose.
+ Prefer object-oriented code using ES6 syntax.
+ All methods, function and members must be documented using JSDoc.
+ `observable.<type>` is used to document and observable that observes a `type`.
+ Use `const` and `let` and avoid the use of `var`.
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
