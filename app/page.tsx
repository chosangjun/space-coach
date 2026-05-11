"use client";

import { ChangeEvent, useEffect, useState } from "react";

type ValidationStatus = "idle" | "checking" | "valid" | "invalid";
type RecommendationItem = {
  title: string;
  location: string;
  reason: string;
  tip: string;
};

const organizingDomains = [
  "방 정리",
  "냉장고 정리",
  "여행가방 짐정리",
  "책상 정리",
  "수납 정리",
];

export default function Home() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(
    [],
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState<string>("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [validationStatus, setValidationStatus] =
    useState<ValidationStatus>("idle");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
  event.target.value = "";

  if (!file) return;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setUploadedFile(file);
    setPreviewUrl(objectUrl);
    setRecommendations([]);
    setErrorMessage(null);
    setValidationStatus("idle");
    setValidationMessage(null);
  };

  const startAnalysis = async () => {
    if (!uploadedFile || isAnalyzing || validationStatus !== "valid") return;

    setIsAnalyzing(true);
    setIsOptimizing(true);
    setErrorMessage(null);
    setRecommendations([]);

    try {
      const optimizedFile = await optimizeImageForApi(uploadedFile);
      setIsOptimizing(false);

      const formData = new FormData();
      formData.append("image", optimizedFile);

      const response = await fetch("/api/analyze-space", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        recommendations?: RecommendationItem[];
        error?: string;
      };

      if (!response.ok || !payload.recommendations) {
        throw new Error(payload.error ?? "정리 추천 분석에 실패했습니다.");
      }

      setRecommendations(payload.recommendations);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "정리 추천 분석에 실패했습니다.";
      setErrorMessage(message);
    } finally {
      setIsOptimizing(false);
      setIsAnalyzing(false);
    }
  };

  const openImageModal = (imageUrl: string, title: string) => {
    setModalImageUrl(imageUrl);
    setModalTitle(title);
  };

  const handleConfirmStart = async () => {
    setIsConfirmModalOpen(false);
    await startAnalysis();
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!uploadedFile) return;

    const allowedTypes = new Set([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ]);

    if (!allowedTypes.has(uploadedFile.type)) {
      setValidationStatus("invalid");
      setValidationMessage(
        "냉장고, 여행가방, 책상, 수납공간처럼 정리나 배치가 필요한 사진을 올려주세요.",
      );
      return;
    }

    let isCancelled = false;

    const validateImage = async () => {
      setValidationStatus("checking");
      setValidationMessage("사진 유형을 확인하고 있습니다...");

      try {
        const formData = new FormData();
        formData.append("image", uploadedFile);

        const response = await fetch("/api/validate-space", {
          method: "POST",
          body: formData,
        });

        const payload = (await response.json()) as {
          isValid?: boolean;
          reason?: string;
          error?: string;
        };

        if (isCancelled) return;

        if (!response.ok) {
          throw new Error(payload.error ?? "이미지 검증에 실패했습니다.");
        }

        if (payload.isValid) {
          setValidationStatus("valid");
          setValidationMessage("정리 가능한 공간 사진으로 확인되었습니다.");
          return;
        }

        setValidationStatus("invalid");
        setValidationMessage(
          payload.reason ??
            "냉장고, 여행가방, 책상, 수납공간처럼 정리나 배치가 필요한 사진을 올려주세요.",
        );
      } catch (error) {
        if (isCancelled) return;
        setValidationStatus("invalid");
        setValidationMessage(
          error instanceof Error
            ? error.message
            : "냉장고, 여행가방, 책상, 수납공간처럼 정리나 배치가 필요한 사진을 올려주세요.",
        );
      }
    };

    void validateImage();

    return () => {
      isCancelled = true;
    };
  }, [uploadedFile]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200/70 px-4 py-6 text-slate-900">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <section className="rounded-3xl bg-white p-5 shadow-[0_8px_28px_-16px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
            공간코치
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-tight">
            공간코치
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            업로드한 사진을 분석해 공간별로 어디에 무엇을 두면 좋은지 추천하고, 이유와 정리 팁까지 함께 안내해드려요.
          </p>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-[0_8px_28px_-16px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80">
          <h2 className="text-base font-semibold">정리할 사진 업로드</h2>
          <p className="mt-1 text-sm text-slate-500">
            방, 냉장고, 여행가방, 책상 등 다양한 공간 사진을 올려주세요.
          </p>
<p className="mt-2 text-xs leading-relaxed text-slate-400">
  업로드한 사진은 AI 분석 후 저장되지 않으며, 추천 생성 용도로만 사용됩니다.
</p>
          <label className="mt-4 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50">
            정리할 사진 업로드
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={handleUpload}
              className="sr-only"
            />
          </label>

          <div className="mt-4 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200/70">
            {previewUrl ? (
              <button
                type="button"
                onClick={() => openImageModal(previewUrl, "업로드 이미지")}
                className="group w-full cursor-pointer overflow-hidden transition-transform duration-300 ease-out hover:scale-[1.015] active:scale-[0.99]"
              >
                <img
                  src={previewUrl}
                  alt="업로드한 사진"
                  className="h-64 max-h-[62vh] w-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                />
              </button>
            ) : (
              <div className="flex h-64 max-h-[62vh] items-center justify-center px-4 text-center text-sm text-slate-500">
                아직 업로드된 이미지가 없습니다.
              </div>
            )}
          </div>
{previewUrl ? (
  <div className="mt-3 flex gap-2">
    <button
      type="button"
      onClick={() => {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }

        setPreviewUrl(null);
        setUploadedFile(null);
        setRecommendations([]);
        setErrorMessage(null);
        setValidationStatus("idle");
        setValidationMessage(null);
      }}
      className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 active:scale-[0.98]"
    >
      사진 제거
    </button>

    <label className="flex-1 cursor-pointer rounded-xl bg-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-300 active:scale-[0.98]">
      다른 사진 선택
      <input
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={handleUpload}
        className="sr-only"
      />
    </label>
  </div>
) : null}
          {validationMessage ? (
            <p
              className={`mt-3 text-xs ${
                validationStatus === "invalid"
                  ? "text-rose-600"
                  : validationStatus === "valid"
                    ? "text-emerald-600"
                    : "text-slate-500"
              }`}
            >
              {validationMessage}
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-[0_8px_28px_-16px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80">
          <h2 className="text-base font-semibold">AI 정리 코치 시작</h2>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(true)}
              disabled={
                !uploadedFile ||
                isAnalyzing ||
                validationStatus !== "valid"
              }
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isAnalyzing
                ? isOptimizing
                  ? "이미지 최적화 중..."
                  : "정리 추천 분석 중..."
                : "정리 추천 시작하기"}
            </button>
            <p className="text-xs text-slate-500">
              AI 분석 시 크레딧이 사용됩니다.
            </p>
          </div>
          <div className="mt-3 rounded-2xl border border-slate-200/90 bg-slate-50 p-3 text-xs text-slate-600">
            방, 냉장고, 여행가방, 책상, 수납공간 등 다양한 공간에 맞는 AI 정리 추천과 배치 팁을 받아보세요.
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-[0_8px_28px_-16px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80">
          <h2 className="text-base font-semibold">AI 추천 카드</h2>
          <div className="mt-3 flex flex-col gap-3">
            {!previewUrl ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                먼저 공간 사진을 업로드해 주세요.
              </div>
            ) : isAnalyzing ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-500" />
                <p className="text-sm text-slate-600">
                  {isOptimizing
                    ? "이미지를 최적화하고 있어요..."
                    : "공간을 분석해 정리 배치 추천을 만드는 중이에요..."}
                </p>
              </div>
            ) : errorMessage ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
                {errorMessage}
              </div>
            ) : recommendations.length > 0 ? (
              recommendations.map((item, index) => (
                <article
                  key={`${item.title}-${index}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-xs font-semibold text-emerald-600">
                    추천 {index + 1}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-semibold">추천 위치:</span> {item.location}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    <span className="font-semibold">이유:</span> {item.reason}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    <span className="font-semibold">정리 팁:</span> {item.tip}
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                정리 추천 시작하기를 누르면 공간 분석 결과가 표시됩니다.
              </div>
            )}
          </div>
        </section>
      </div>

      {modalImageUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/85 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-slate-950 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-white">{modalTitle}</p>
              <button
                type="button"
                onClick={() => setModalImageUrl(null)}
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                닫기
              </button>
            </div>
            <div className="overflow-hidden rounded-xl bg-slate-900">
              <img
                src={modalImageUrl}
                alt={modalTitle}
                className="h-[70vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}

      {isConfirmModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.7)] ring-1 ring-slate-200">
            <h3 className="text-base font-semibold text-slate-900">
              공간 분석을 시작하시겠습니까?
            </h3>
            <p className="mt-2 text-xs text-slate-500">
              시작하기를 누르면 AI가 배치 추천을 분석합니다.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleConfirmStart}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                시작하기
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

async function optimizeImageForApi(file: File): Promise<File> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);

  const maxDimension = 1536;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("이미지 최적화 캔버스를 만들지 못했습니다.");
  }

  context.drawImage(image, 0, 0, width, height);

  const outputType = file.type === "image/png" ? "image/webp" : "image/jpeg";
  const quality = 0.84;
  const optimizedBlob = await canvasToBlob(canvas, outputType, quality);

  const extension = outputType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");

  return new File([optimizedBlob], `${baseName}-optimized.${extension}`, {
    type: outputType,
    lastModified: Date.now(),
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("이미지를 읽지 못했습니다."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("이미지 파일 읽기에 실패했습니다."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지 로드에 실패했습니다."));
    image.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("이미지 압축 처리에 실패했습니다."));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}
