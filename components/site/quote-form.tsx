'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Send } from 'lucide-react'
import { services } from '@/data/services'
import { fieldClassName, inputClassName, labelClassName } from '@/lib/form-styles'
import Link from 'next/link'

type FormState = {
  name: string
  email: string
  phone: string
  service: string
  pickup: string
  destination: string
  schedule: string
  notes: string
}

const initialState: FormState = {
  name: '',
  email: '',
  phone: '',
  service: '',
  pickup: '',
  destination: '',
  schedule: '',
  notes: '',
}

export function QuoteForm() {
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
          Quote request received
        </h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Thanks, {form.name || 'there'}. This is a demonstration form — in production,
          your request would be sent to our dispatch team for follow-up.
        </p>
        <button
          type="button"
          onClick={() => {
            setForm(initialState)
            setSubmitted(false)
          }}
          className="mt-6 text-sm font-semibold text-primary hover:underline"
        >
          Submit another request
        </button>
      </motion.div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <fieldset className="space-y-5">
        <legend className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Contact details
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className={fieldClassName}>
            <label htmlFor="quote-name" className={labelClassName}>
              Full name <span className="text-primary">*</span>
            </label>
            <input
              id="quote-name"
              required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className={inputClassName}
              autoComplete="name"
            />
          </div>
          <div className={fieldClassName}>
            <label htmlFor="quote-phone" className={labelClassName}>
              Phone <span className="text-primary">*</span>
            </label>
            <input
              id="quote-phone"
              type="tel"
              required
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className={inputClassName}
              autoComplete="tel"
            />
          </div>
        </div>
        <div className={fieldClassName}>
          <label htmlFor="quote-email" className={labelClassName}>
            Email <span className="text-primary">*</span>
          </label>
          <input
            id="quote-email"
            type="email"
            required
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            className={inputClassName}
            autoComplete="email"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Delivery details
        </legend>
        <div className={fieldClassName}>
          <label htmlFor="quote-service" className={labelClassName}>
            Service type <span className="text-primary">*</span>
          </label>
          <select
            id="quote-service"
            required
            value={form.service}
            onChange={(e) => update('service', e.target.value)}
            className={inputClassName}
          >
            <option value="">Select a service</option>
            {services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className={fieldClassName}>
            <label htmlFor="quote-pickup" className={labelClassName}>
              Pickup address <span className="text-primary">*</span>
            </label>
            <input
              id="quote-pickup"
              required
              value={form.pickup}
              onChange={(e) => update('pickup', e.target.value)}
              placeholder="Street, city, postal code"
              className={inputClassName}
            />
          </div>
          <div className={fieldClassName}>
            <label htmlFor="quote-destination" className={labelClassName}>
              Delivery address <span className="text-primary">*</span>
            </label>
            <input
              id="quote-destination"
              required
              value={form.destination}
              onChange={(e) => update('destination', e.target.value)}
              placeholder="Street, city, postal code"
              className={inputClassName}
            />
          </div>
        </div>
        <div className={fieldClassName}>
          <label htmlFor="quote-schedule" className={labelClassName}>
            Preferred date &amp; time
          </label>
          <input
            id="quote-schedule"
            value={form.schedule}
            onChange={(e) => update('schedule', e.target.value)}
            placeholder="e.g. Today before 5 PM, or Friday morning"
            className={inputClassName}
          />
        </div>
        <div className={fieldClassName}>
          <label htmlFor="quote-notes" className={labelClassName}>
            Additional details
          </label>
          <textarea
            id="quote-notes"
            rows={4}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Package size, special handling, regulated requirements, etc."
            className={`${inputClassName} resize-y min-h-[100px]`}
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-muted-foreground">
          By submitting, you agree we may contact you about this request.{' '}
          <Link href="/main-website/contact" className="text-primary hover:underline">
            Questions?
          </Link>
        </p>
        <button
          type="submit"
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--signal-dark)] sm:w-auto"
        >
          <Send className="size-4" />
          Submit quote request
        </button>
      </div>
    </form>
  )
}
