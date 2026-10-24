"use client";

import { useForm, useStore } from "@tanstack/react-form";

export default function MessageForm() {
    const form = useForm({
        defaultValues: {
            text: "",
        },
        onSubmit: ({ value }) => {
            console.log(value);
        },
    });


    // // Watch the text stored in the form.
    const text = useStore(
        form.store,
        (state) => state.values.text,
    );

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
            }}
        >

            <form.Field name="text">
                {(field) => (
                    <>
                        <textarea
                            value={field.state.value}
                            onChange={(event) =>
                                field.handleChange(event.target.value)
                            }
                        />
                    </>


                )}
            </form.Field>

            <p>Characters: {text.trim().length}</p>

            <button type="submit">Submit</button>
        </form>
    );
}