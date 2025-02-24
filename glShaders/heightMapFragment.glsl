/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// Fragment shader for the material

// How much precision the GPU uses when calculating floats.
precision mediump float;

/*in*/varying vec4 colour;

void main(void) {
  //layout(location = 0) out vec4 colour; // OpenGL 3+
  gl_FragColor = colour;
}
