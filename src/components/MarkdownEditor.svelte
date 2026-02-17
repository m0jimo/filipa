<script lang="ts">
  import MarkdownPreview from "./MarkdownPreview.svelte";

  type ViewMode = "raw" | "split" | "preview";

  interface Props {
    value: string;
    id?: string;
    name?: string;
    placeholder?: string;
    required?: boolean;
    rows?: number;
    label?: string;
    helpText?: string;
    initialViewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
  }

  let {
    value = $bindable(),
    id,
    name,
    placeholder = "",
    required = false,
    rows = 5,
    label,
    helpText,
    initialViewMode = "raw",
    onViewModeChange,
  }: Props = $props();

  let viewMode = $state<ViewMode>(initialViewMode);

  const setViewMode = (mode: ViewMode) => {
    viewMode = mode;
    onViewModeChange?.(mode);
  };

  const modes: { mode: ViewMode; label: string; icon: string }[] = [
    { mode: "raw", label: "Raw", icon: "📝" },
    { mode: "split", label: "Split", icon: "⬌" },
    { mode: "preview", label: "Preview", icon: "👁" },
  ];

  let textareaElement: HTMLTextAreaElement | null = $state(null);
  let fileInputElement: HTMLInputElement | null = $state(null);
  let isTextareaFocused = $state(false);

  function handleImageUpload() {
    if (!isTextareaFocused) return;
    fileInputElement?.click();
  }

  function handleTextareaFocus() {
    isTextareaFocused = true;
  }

  function handleTextareaBlur() {
    // Small delay to allow button click to register
    setTimeout(() => {
      isTextareaFocused = false;
    }, 200);
  }

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 10MB before optimization)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert("Image size must be less than 10MB");
      return;
    }

    try {
      // Resize and optimize image (max width 1280px)
      const optimizedBase64 = await resizeAndOptimizeImage(file, 1280, 0.85);

      // Get optimized image dimensions
      const dimensions = await getImageDimensions(optimizedBase64);

      // Set display size (max width 640px for display)
      const maxDisplayWidth = 640;
      const scale = dimensions.width > maxDisplayWidth ? maxDisplayWidth / dimensions.width : 1;
      const displayWidth = Math.round(dimensions.width * scale);
      const displayHeight = Math.round(dimensions.height * scale);

      // Create markdown image with HTML syntax for size control
      const imageMarkdown = `<img src="${optimizedBase64}" alt="Image" width="${displayWidth}" height="${displayHeight}" />\n<!-- To resize: change width="${displayWidth}" height="${displayHeight}" | Actual size: ${dimensions.width}x${dimensions.height} -->\n`;

      // Insert at cursor position
      insertAtCursor(imageMarkdown);
    } catch (err) {
      console.error("Error processing image:", err);
      alert("Failed to process image");
    }

    // Reset file input
    input.value = "";
  }

  function resizeAndOptimizeImage(file: File, maxWidth: number, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          // Create canvas for resizing
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          // Draw resized image
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to base64 with compression
          // Use JPEG for better compression, PNG for transparency
          const hasTransparency =
            file.type === "image/png" || file.type === "image/gif" || file.type === "image/webp";
          const mimeType = hasTransparency ? "image/png" : "image/jpeg";
          const base64 = canvas.toDataURL(mimeType, quality);

          resolve(base64);
        };

        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = reject;
      img.src = base64;
    });
  }

  function insertAtCursor(text: string) {
    if (!textareaElement) return;

    const start = textareaElement.selectionStart;
    const end = textareaElement.selectionEnd;
    const before = value.substring(0, start);
    const after = value.substring(end);

    value = before + text + after;

    // Set cursor position after inserted text
    setTimeout(() => {
      if (textareaElement) {
        const newPosition = start + text.length;
        textareaElement.focus();
        textareaElement.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  }
</script>

<div class="markdown-editor">
  {#if label}
    <label for={id} class="editor-label">
      {label}
      {#if required}<span class="required">*</span>{/if}
    </label>
  {/if}

  <!-- Hidden file input for image upload -->
  <input
    type="file"
    accept="image/*"
    bind:this={fileInputElement}
    onchange={handleFileSelect}
    style="display: none;"
  />

  <div class="toolbar">
    <div class="command-buttons">
      <button
        type="button"
        class="command-btn"
        title={isTextareaFocused ? "Insert image from file" : "Click in the text field first"}
        onclick={handleImageUpload}
        disabled={!isTextareaFocused}
      >
        🖼️
      </button>
    </div>

    <div class="mode-switcher">
      {#each modes as { mode, label: modeLabel, icon } (mode)}
        <button
          type="button"
          class="mode-btn"
          class:active={viewMode === mode}
          onclick={() => setViewMode(mode)}
          title={modeLabel}
        >
          {icon}
          {modeLabel}
        </button>
      {/each}
    </div>
  </div>

  <div class="editor-content" class:split={viewMode === "split"}>
    {#if viewMode === "raw" || viewMode === "split"}
      <div class="editor-pane">
        <textarea
          bind:this={textareaElement}
          {id}
          {name}
          bind:value
          {required}
          {placeholder}
          {rows}
          class="editor-textarea"
          autocomplete="off"
          data-lpignore="true"
          data-form-type="other"
          onfocus={handleTextareaFocus}
          onblur={handleTextareaBlur}
        ></textarea>
      </div>
    {/if}

    {#if viewMode === "preview" || viewMode === "split"}
      <div class="preview-pane">
        {#if value.trim()}
          <MarkdownPreview md={value} />
        {:else}
          <div class="preview-empty">No content to preview</div>
        {/if}
      </div>
    {/if}
  </div>

  {#if helpText}
    <small class="help-text">{helpText}</small>
  {/if}
</div>

<style>
  .markdown-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .editor-label {
    font-weight: 600;
    color: var(--color-text);
  }

  .required {
    color: #d32f2f;
    margin-left: 0.25rem;
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 0.5rem;
    gap: 1rem;
  }

  .command-buttons {
    display: flex;
    gap: 0.25rem;
  }

  .command-btn {
    padding: 0.25rem 0.5rem;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .command-btn:hover:not(:disabled) {
    background: #e0e0e0;
    border-color: #999;
  }

  .command-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: var(--color-bg-subtle);
    border-color: #ddd;
  }

  .mode-switcher {
    display: flex;
    gap: 0.25rem;
  }

  .mode-btn {
    padding: 0.25rem 0.5rem;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .mode-btn:hover {
    background: #e0e0e0;
    border-color: #999;
  }

  .mode-btn.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .editor-content {
    display: flex;
    gap: 1rem;
    min-height: 200px;
  }

  .editor-content:not(.split) {
    gap: 0;
  }

  .editor-pane {
    flex: 1;
    display: flex;
  }

  .editor-content.split .editor-pane {
    flex: 1;
  }

  .editor-content:not(.split) .editor-pane {
    width: 100%;
  }

  .editor-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-family: "Courier New", monospace;
    font-size: 0.9rem;
    resize: vertical;
    line-height: 1.5;
  }

  .editor-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
  }

  .preview-pane {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: #fafafa;
    overflow-y: auto;
    max-height: 500px;
  }

  .preview-empty {
    color: #999;
    font-style: italic;
    text-align: center;
    padding: 2rem;
  }

  .help-text {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    margin-top: -0.25rem;
  }

  /* Dark theme */
  :global([data-theme="dark"]) .editor-label {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .toolbar {
    border-bottom-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .command-btn {
    background: #3a3a3a;
    border-color: #555;
    color: #ffffff;
  }

  :global([data-theme="dark"]) .command-btn:hover:not(:disabled) {
    background: #4a4a4a;
    border-color: var(--color-text-secondary);
  }

  :global([data-theme="dark"]) .command-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  :global([data-theme="dark"]) .mode-btn {
    background: #3a3a3a;
    border-color: #555;
    color: #ffffff;
  }

  :global([data-theme="dark"]) .mode-btn:hover {
    background: #4a4a4a;
    border-color: var(--color-text-secondary);
  }

  :global([data-theme="dark"]) .mode-btn.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  :global([data-theme="dark"]) .editor-textarea {
    background: var(--color-bg-dark);
    border-color: var(--color-border-dark);
    color: #ffffff;
  }

  :global([data-theme="dark"]) .editor-textarea:focus {
    border-color: var(--color-primary);
  }

  :global([data-theme="dark"]) .preview-pane {
    background: var(--color-bg-dark);
    border-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .preview-empty {
    color: var(--color-text-secondary);
  }

  :global([data-theme="dark"]) .help-text {
    color: var(--color-text-muted);
  }
</style>
