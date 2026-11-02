import { Camera, CameraDirection } from "@capacitor/camera";

const MAX_PHOTO_EDGE = 512;

export async function takeProfilePhoto(): Promise<string> {
  const result = await Camera.takePhoto({
    cameraDirection: CameraDirection.Front,
    quality: 70,
    targetWidth: MAX_PHOTO_EDGE,
    targetHeight: MAX_PHOTO_EDGE,
  });

  if (result.webPath) {
    const response = await fetch(result.webPath);
    if (!response.ok) {
      throw new Error("La photo sélectionnée n’a pas pu être lue.");
    }
    return resizePhoto(URL.createObjectURL(await response.blob()));
  }
  if (result.thumbnail) {
    return resizePhoto(`data:image/jpeg;base64,${result.thumbnail}`);
  }
  throw new Error("La caméra n’a renvoyé aucune photo.");
}

export async function readProfilePhoto(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Le fichier photo n’a pas pu être lu."));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Lecture de la photo impossible.")));
    reader.readAsDataURL(file);
  });
  return resizePhoto(dataUrl);
}

async function resizePhoto(source: string): Promise<string> {
  const image = new Image();
  image.src = source;
  try {
    await image.decode();
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("La photo ne peut pas être traitée sur cet appareil.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } finally {
    if (source.startsWith("blob:")) URL.revokeObjectURL(source);
  }
}
