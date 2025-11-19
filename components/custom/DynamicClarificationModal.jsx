"use client";

import React, { useState } from "react";

export default function DynamicClarificationModal({
    open,
    prompt,
    questions,
    onClose,
    onDone,
}) {
    const [answers, setAnswers] = useState({});

    if (!open) return null;

    const handleChange = (idx, value) => {
        setAnswers((prev) => ({ ...prev, [idx]: value }));
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999]">
            <div className="bg-white p-6 rounded-xl w-[450px] shadow-xl">
                <h2 className="text-lg font-semibold mb-3">Before we generate…</h2>

                <p className="text-sm text-gray-700 mb-3">
                    Please answer a few quick questions to improve the website.
                </p>

                <div className="max-h-[350px] overflow-y-auto space-y-4">
                    {questions.map((q, i) => (
                        <div key={i}>
                            <label className="text-sm font-medium">{q}</label>
                            <input
                                className="border p-2 mt-1 w-full rounded"
                                placeholder="Type answer…"
                                onChange={(e) => handleChange(i, e.target.value)}
                            />
                        </div>
                    ))}
                </div>

                <div className="mt-6 flex justify-between">
                    <button className="px-3" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="bg-blue-600 text-white px-4 py-1 rounded"
                        onClick={() => onDone(answers)}
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
}
