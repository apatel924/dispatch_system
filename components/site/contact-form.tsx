'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Send } from 'lucide-react'
import { fieldClassName, inputClassName, labelClassName } from '@/lib/form-styles'

type FormState = {
  name: string
  email: string
  phone: string
  subject: string
  message: string
}

const initialState: FormState = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
}

export function ContactForm() {
  const [form, setForm] = useState<FormState>(initialState)
  const [submitted, setSubmitted] = useState(false)

  function update(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-primary/30 bg-primary/5 p-8 text-center sm:p-10"
      >
        <CheckCircle2 className="mx-auto size-12 text-primary" />
        <h3 className="mt-4 text-xl font-bold uppercase tracking-tight text-foreground">
          Message sent
        </h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Thanks for reaching out, {form.name || 'there'}. This is a demonstration form —
          in production, your message would be delivered to our team.
        </p>
        <button
          type="button"
          onClick={() => {
            setForm(initialState)
            setSubmitted(false)
          }}
          className="mt-6 text-sm font-semibold text-primary hover:underline"
        >
          Send another message
        </button>
      </motion.div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className={fieldClassName}>
          <label htmlFor="contact-name" className={labelClassName}>
            Full name <span className="text-primary">*</span>
          </label>
          <input
            id="contact-name"
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className={inputClassName}
            autoComplete="name"
          />
        </div>
        <div className={fieldClassName}>
          <label htmlFor="contact-phone" className={labelClassName}>
            Phone
          </label>
          <input
            id="contact-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            className={inputClassName}
            autoComplete="tel"
          />
        </div>
      </div>
      <div className={fieldClassName}>
        <label htmlFor="contact-email" className={labelClassName}>
          Email <span className="text-primary">*</span>
        </label>
        <input
          id="contact-email"
          type="email"
          required
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          className={inputClassName}
          autoComplete="email"
        />
      </div>
      <div className={fieldClassName}>
        <label htmlFor="contact-subject" className={labelClassName}>
          Subject <span className="text-primary">*</span>
        </label>
        <select
          id="contact-subject"
          required
          value={form.subject}
          onChange={(e) => update('subject', e.target.value)}
          className={inputClassName}
        >
          <option value="">Select a topic</option>
          <option value="general">General inquiry</option>
          <option value="quote">Delivery quote</option>
          <option value="business">Business delivery</option>
          <option value="regulated">Regulated delivery</option>
          <option value="tracking">Tracking support</option>
          <option value="coverage">Coverage area</option>
        </select>
      </div>
      <div className={fieldClassName}>
        <label htmlFor="contact-message" className={labelClassName}>
          Message <span className="text-primary">*</span>
        </label>
        <textarea
          id="contact-message"
          required
          rows={5}
          value={form.message}
          onChange={(e) => update('message', e.target.value)}
          placeholder="How can we help?"
          className={`${inputClassName} min-h-[120px] resize-y`}
        />
      </div>
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--signal-dark)] sm:w-auto"
      >
        <Send className="size-4" />
        Send message
      </button>
    </form>
  )
}
