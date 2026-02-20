"use client";

import React from "react";

function baseInputClasses(disabled) {
  return [
    "w-full",
    "px-3",
    "py-2",
    "border",
    "border-gray-300",
    "rounded-lg",
    "bg-white",
    "text-gray-900",
    "placeholder:text-gray-400",
    "focus:outline-none",
    "focus:ring-2",
    "focus:ring-blue-500",
    "focus:border-blue-500",
    disabled
      ? "bg-gray-100 text-gray-700 cursor-not-allowed"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Reusable form field.
 * - variant: "input" | "textarea"
 */
export default function FormField({
  id,
  label,
  helper,
  error,
  variant = "input",
  className = "",
  inputRef,
  ...props
}) {
  const disabled = Boolean(props.disabled);
  const inputClass = baseInputClasses(disabled);

  return (
    <div className={`space-y-1 ${className}`.trim()}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-900"
        >
          {label}
        </label>
      )}

      {variant === "textarea" ? (
        <textarea
          id={id}
          ref={inputRef}
          className={`${inputClass} min-h-[96px] resize-y`}
          disabled={disabled}
          {...props}
        />
      ) : (
        <input
          id={id}
          ref={inputRef}
          className={inputClass}
          disabled={disabled}
          {...props}
        />
      )}

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : helper ? (
        <p className="text-sm text-gray-600">{helper}</p>
      ) : null}
    </div>
  );
}