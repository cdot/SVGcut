uniform vec3 scale;
uniform vec3 translate;
uniform mat4 rotate;

attribute vec3 vPos;
attribute vec3 vColor;

varying vec4 color;

void main(void) {
  mat4 translateScale = mat4(
        scale.x,        0.0,            0.0,                0.0,
        0.0,            scale.y,        0.0,                0.0,
        0.0,            0.0,            scale.z,            0.0,
        translate.x,    translate.y,    translate.z,        1.0
                               );
  float left = -.6;
  float right = .6;
  float top = .6;
  float bot = -.6;
  float near = 2.0;
  float far = 5.0;
  mat4 camera = mat4(
        2.0*near/(right-left),      0.0,                    0.0,                        0.0,
        0.0,                        2.0*near/(top-bot),     0.0,                        0.0,
        (right+left)/(right-left),  (top+bot)/(top-bot),    (far+near)/(near-far),      -1,
        0.0,                        0.0,                    2.0*far*near/(near-far),    0.0
    );

  gl_Position = camera * (rotate * translateScale * vec4(vPos, 1.0) + vec4(0.0, 0.0, -3.5, 0.0));
  color = vec4(vColor, 1.0);
}
