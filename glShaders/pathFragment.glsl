precision mediump float;

varying vec4 color;
varying vec2 center;
varying float radius;
varying float enable;

void main(void) {
  gl_FragColor = color;
  if (enable == 0.0
      || radius > 0.0 && distance(gl_FragCoord.xy, center) > radius)
    discard;
}
