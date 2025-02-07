/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// Fragment shader used for the cutter

// How much precision the GPU uses when calculating floats.
precision mediump float;

// Colour comes from code
uniform vec4 colour;

void main(void) {
  gl_FragColor = colour;
  //V3 layout(location = 0) out vec4 colour;
}
