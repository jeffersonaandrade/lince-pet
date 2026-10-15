"use client";

import dynamic from "next/dynamic";
import animationData from "../../../../public/lottieLoading/Pet Loading.json";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

interface LottieLoadingProps {
  width?: string | number;
  height?: string | number;
}

// Azul original do JSON: [0.098, 0.3059, 0.5804, 1]; laranja primário (#e67e22): [0.902, 0.494, 0.133, 1]
const targetBlue = [0.098, 0.3059, 0.5804];
const replacementColor = [0.902, 0.494, 0.133];

const checkAndReplace = (arr: unknown) => {
  if (!Array.isArray(arr) || arr.length < 3 || typeof arr[0] !== "number") return;
  const [r, g, b] = arr;
  const isBlue =
    Math.abs(r - targetBlue[0]) < 0.01 &&
    Math.abs(g - targetBlue[1]) < 0.01 &&
    Math.abs(b - targetBlue[2]) < 0.01;
  if (isBlue) {
    arr[0] = replacementColor[0];
    arr[1] = replacementColor[1];
    arr[2] = replacementColor[2];
  }
};

const replaceColor = (valor: unknown) => {
  if (typeof valor !== "object" || valor === null) return;
  const obj = valor as Record<string, unknown>;

  // 'k' é a cor sólida ou a lista de keyframes (com 's'/'e')
  if (Array.isArray(obj.k)) {
    if (typeof obj.k[0] === "number") {
      checkAndReplace(obj.k);
    } else {
      for (const keyframe of obj.k as { s?: unknown; e?: unknown }[]) {
        if (keyframe?.s) checkAndReplace(keyframe.s);
        if (keyframe?.e) checkAndReplace(keyframe.e);
      }
    }
  }

  checkAndReplace(obj.s);
  checkAndReplace(obj.e);

  for (const key in obj) {
    if (key !== "k") replaceColor(obj[key]);
  }
};

const modifiedAnimationData = JSON.parse(JSON.stringify(animationData));
replaceColor(modifiedAnimationData);

const LottieLoading = ({ width = 250, height = 250 }: LottieLoadingProps) => {
  return (
    <div 
      style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        justifyContent: "center", 
        padding: "40px 20px",
        width: "100%",
        minHeight: "300px"
      }}
    >
      <div style={{ width, height }}>
        <Lottie 
          animationData={modifiedAnimationData} 
          loop={true} 
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
};

export default LottieLoading;
