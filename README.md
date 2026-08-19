# Drive Smart Bulawayo

Auto Driving School with the logo apperaring accross the site and the (url with the logo also and should display website name which AUTO DRIVING SCHOOL )

make sure every image is accpeted and appears nicely please

Paste everything below into Lovable to start the build.

Build a website for Auto Driving School, a driving school in Bulawayo, Zimbabwe.

Business Info

Name: Auto Driving School

Address: 10th Ave & Joshua Nkomo St, Bulawayo (Plus code: RHRJ+9F Bulawayo)

Phone / WhatsApp: 078 873 3625

Hours: Open daily, closes 6pm

Tech & Design System

React + TypeScript + Tailwind + shadcn/ui

No backend/database yet — this is the foundation build. Use local persistence only for now (browser storage / in-memory state that survives a refresh), structured so every piece of data (enquiries, packages, instructors, testimonials, photos, promotions, driving tips, site settings) is read/written through a single small data-access layer (e.g. a set of hooks or a lib/data.ts file), not scattered directly through components — this way it's a clean swap to a real backend like Supabase later without rewriting the pages

Support light and dark mode via a .dark class toggle

Use CSS custom properties in oklch format for all colors (background, foreground, card, primary, secondary, muted, accent, destructive, border, input, ring) so a custom stylesheet can be dropped in later without touching components

Fonts: Space Grotesk for headings, Inter for body text, JetBrains Mono for small labels/accents (e.g. package tags, prices)

Base border radius: 0.625rem, with derived sm/md/lg/xl variants

Clean, minimal, professional — mobile-first, since most visitors will browse on phones

Include a favicon and site logo: use a placeholder logo mark (simple geometric icon, e.g. a steering wheel or road-line motif in the primary color) for both the favicon and the header/footer logo, sized appropriately (32x32 and 180x180 for favicon/apple-touch-icon), clearly named as placeholders so they're easy to swap for the real logo files later

Notifications / Toasts

Use a single consistent toast system (shadcn/ui Toast or Sonner) across the whole site for all feedback: form submission success/error, admin save/update/delete confirmations, upload progress and completion, login success/failure

Style toasts to match the design system (rounded corners matching the base radius, theme colors, readable in both light and dark mode) with a distinct icon and color per variant: success (green check), error (red alert), info (neutral), warning (amber)

Position consistently (e.g. top-right on desktop, top-center on mobile), auto-dismiss after ~4s except errors which stay until dismissed, and keep copy short and specific ("Photo uploaded", "Enquiry saved — we'll be in touch", "Upload failed — try a smaller image") rather than generic

Image Uploads (local storage for now)

This must actually work end-to-end, not just show a blank/broken preview:

Since there's no backend yet, store uploaded images as data URLs (base64) in local storage, keyed alongside the record they belong to (photo, instructor, promotion flyer, driving tip attachment, logo)

Every upload control (photos & media, instructors, promotions, driving tips, gallery, about-us photos, contact banner, logo) must read the selected file, convert it, save it, and only mark the item as saved once it's confirmed written — show a brief loading/progress state while this happens so it's clear something is happening

Support drag-and-drop and click-to-browse file selection, accept standard image formats (jpg, png, webp) with a sensible max size (e.g. 2MB, since local storage has limited space) and show a clear toast error if a file is rejected (wrong type/too large) or if saving fails for any reason — never fail silently

Support multi-file selection: let the admin select or drag several images at once and save them all in one batch, with per-file progress and a summary toast when the batch finishes (e.g. "8 of 8 photos uploaded")

Note in a code comment near the data-access layer that this local-storage image handling is a placeholder and should be swapped for real file storage (e.g. Supabase Storage) once a backend is added, since local storage has limited capacity and won't scale to many/large images

Pages

Home

Full-width hero image carousel (autoplay ~5s, pause on hover, swipeable, small dot indicators, dark gradient overlay at the bottom for text legibility) — placeholder images of the school building/signage, cars, instructor with learner, students at the yard

Active promotions banner (flyer image, title, dates) shown just below the hero if any promotion is currently active

Headline + CTA buttons ("Book a Lesson" / WhatsApp)

Trust strip: VID registered, dual-control vehicles, years operating

Stats / social-proof band: a row of 3-4 big numbers with short labels (e.g. "500+ Learners Trained", "92% First-Time Pass Rate", "12 Years in Bulawayo") — the numbers and labels are plain editable text fields in the admin Site Settings, not calculated from data, so the school can set/update them anytime

Packages preview: 3 package cards linking to full Pricing page

Gallery preview strip: 6-8 photos tagged "Gallery", linking to the full Gallery page

Testimonials strip

CTA band before footer

Footer with address, phone, hours, map link

About

Give this a proper structured layout with real visual variety, not just stacked text blocks:

Header banner image (full-width, tagged "About Us" photo, with the page title overlaid)

School story section: text on one side, a supporting photo on the other (alternate left/right if there are multiple story paragraphs)

Why-choose-us section: icon + short text cards in a grid (VID registered, dual-control vehicles, experienced instructors, flexible scheduling)

Instructor team photo grid (cards: photo, name, years experience, languages) — pulls from the same Instructors data as the Instructors page, each card links to that instructor's profile page

"Around our school" photo gallery strip: a row/grid of photos specifically tagged for the About page (separate from the general Gallery), showing the yard, vehicles, classroom, students in training

VID registration mention/badge

Closing CTA band ("Ready to start driving?" — Book a Lesson / WhatsApp)

Packages / Pricing

Package cards (Beginner, Full Course, Refresher, etc.) — each with price, lesson count, what's included. Emphasize bundles over single lessons. If a package has an active promotion, show the original price struck through next to the discounted price.

Instructors

Cards: photo, name, years experience, languages spoken — clicking a card opens that instructor's own profile page (e.g. /instructors/mr-ncube)

Instructor profile page: larger photo, name, years experience, languages, and a short bio/intro paragraph. Bio is an additional editable field on the same Instructor record in admin — no separate data source, just one more field alongside name/years/languages

Gallery

Full photo gallery page showing all Published photos tagged "Gallery", in a responsive grid (masonry or even grid)

Clicking a photo opens a lightbox (next/prev navigation, caption shown, close on click-outside or Escape)

If there are many photos, paginate or lazy-load rather than loading everything at once

Driving Tips

List of tips/"did you know" cards — title, body text, optional image or PDF attachment (opens/downloads on click). Helps learners prep for the VID test and pick up general good-driving habits.

FAQ

Accordion covering: VID licensing process, minimum lessons required, what to bring, cancellation policy.

Contact / Book a Lesson

Give this page real presence instead of a bare form:

Hero banner: full-width photo (tagged "Contact" in Photos admin, most recent Published one used; falls back to a placeholder image if none is set yet) with "Book a Lesson" as the overlaid headline and a short supporting line underneath

Booking form, redesigned:

Package selection as clickable cards (name, price, lesson count) instead of a plain dropdown — tapping one selects it

Name and phone/WhatsApp fields

Preferred schedule as toggle chips: days of the week (Mon-Sun) plus a Morning/Afternoon/Evening selector, instead of a free-text field

Hidden honeypot field (invisible to real users, catches bots) — reject any submission where it's filled in

On submit, save to local storage (same Enquiry data as before: name, phone, package, preferred days/times) and replace the form with a confirmation state (checkmark, "Thanks [Name], we'll WhatsApp you within a few hours") that includes a WhatsApp button as a backup contact option

A short reassurance line under the submit button ("We reply within a few hours — no spam, ever")

Contact info card next to the form: address + embedded Google Map (live iframe embed, driven by the address in Site Settings), phone, hours, WhatsApp button — sticky/pinned on desktop as the page scrolls so it stays reachable

Floating WhatsApp button (click-to-chat) visible on every page site-wide, not just this one

Admin — /admin

Password gate: hardcoded password auto2026, checked client-side only — no full auth system, keep it lightweight. Show a toast/inline error on wrong password.

Once unlocked, show a dashboard with a persistent sidebar/nav so every section below is one click away, and every editor listed here needs working Add, Edit, and Delete buttons (with a confirmation step before delete), plus a visible Save/Cancel on any edit form:

Enquiries inbox: table of form submissions (name, phone, package, preferred days/times), with a status dropdown per row (New / Contacted / Enrolled)

Packages editor: edit price, lesson count, description for each package

Instructors editor: add/edit/remove instructor cards, each with a photo upload and a bio text field

Testimonials editor: add/edit/remove testimonials, each with a status (Pending / Published) — entries submitted through the public review form land here as Pending for approval before they show publicly

Photos & media: upload company photos (cars, building, instructors, students), each with a caption/description field, a category tag (Hero Carousel / Gallery / About Us / Contact) so you control exactly where each photo shows up, and a status (Pending Review / Published). Only Published photos show on their tagged section — this lets you upload a batch, review how they look, then approve which ones go live. Support uploading multiple photos at once (see Image Uploads section above)

Promotions: upload a flyer image or PDF for each promotion, plus a title, description, start/end date, and status (Active / Expired). Each promotion can optionally link to a specific package and override its price for the promo period (e.g. show a struck-through original price next to the discounted one). Active promotions display in a banner/section on the Home page and Pricing page automatically; once the end date passes, mark it Expired (or auto-expire by date) and it disappears from public view without deleting the record

Driving tips / "Did you know": upload short tips as text, or attach an image/PDF (e.g. a road-sign cheat sheet or a scanned Highway Code excerpt), each with a title and body text. These feed a "Tips" section/page so learners can browse test-prep advice and general driving tips

Site settings: editable fields for phone number, WhatsApp number, address, opening hours, home page headline/tagline text, and the stats/social-proof band numbers and labels — these feed the header, footer, contact page, hero section, and stats band site-wide

Stats summary: count of enquiries this week and this month

Public review submission

A short public form (name, star rating 1-5, comment) reachable from the About page or a "Leave a review" link — separate from the booking form

Submissions save into the same Testimonials data, with status set to Pending — they never show publicly until an admin flips them to Published in the Testimonials editor

Show a toast confirming submission ("Thanks — your review will appear once approved")

SEO & Social Sharing

Set a distinct <title> and meta description for each page (Home, About, Packages, Instructors, Gallery, Driving Tips, FAQ, Contact), written around driving lessons in Bulawayo

Add Open Graph and Twitter Card tags (og:title, og:description, og:image, og:url) so links shared on WhatsApp/Facebook show a proper preview — use a placeholder social preview image (1200x630) featuring the logo mark, swappable later

Include a basic robots meta tag allowing indexing

Generate a sitemap.xml listing every public page, and a robots.txt that allows indexing of the public site but disallows /admin

Add a friendly custom 404 page (short message + a button back to Home) instead of a blank error for unmatched routes

Data

For this foundation build, use browser local storage (via the single data-access layer described above) for everything: enquiries, packages, instructors (with bio), testimonials (with status), photos (with caption, category tag, and status fields), promotions (with linked package, promo price, dates, and status), driving tips (with optional file attachment), and site settings (including stats band values). Structure this cleanly so it can be swapped for a real backend (e.g. Supabase) later without reworking the pages — none of the pages/components should talk to local storage directly, they should all go through the data-access layer.

Notes

WhatsApp button links to https://wa.me/263788733625

Keep component structure semantic and unstyled-by-default where possible (rely on the CSS variables above) so a custom stylesheet can be swapped in post-export with minimal conflicts

Every interactive element (nav links, mobile menu toggle, all CTA buttons, WhatsApp floating button, form submit buttons, package selection cards, day/time chips, admin login, and every admin Add/Edit/Save/Cancel/Delete button) should have a clear hover/active state and, where an action takes time (upload, save, submit), a loading state so it's obvious something is happening

This is a local-storage foundation build — enquiries, photos, and other admin data will only persist in the browser they were entered in, and won't sync across devices. That's expected for now; a real backend can be connected later.

Lovable Prompt — Fix Image Cropping on Banners

Paste this into Lovable as a follow-up prompt on the existing project.

Fix an image display bug: banner-style photo sections (Hero Carousel on Home, the About page banner, and the Contact page banner) currently use crop-to-fill display, which cuts off parts of any uploaded image that doesn't match the banner's aspect ratio exactly — this is especially bad for uploaded graphics/logos with text near the edges, but affects any photo too.

Replace crop-to-fill with a "contain + blurred backdrop" display for these banner slots:

Show the full uploaded image, uncropped, centered in the frame, scaled to fit at its original quality (no part of it ever cut off)

Fill the empty space around it with a softly blurred, scaled-up copy of the same image as a backdrop, so there are no ugly empty bars — this keeps the section looking full-bleed even though the foreground image isn't stretched or cropped

This applies to: Home hero carousel slides, About page banner image, Contact page banner image

Leave all other image displays as-is (Gallery grid, Photos admin thumbnails, instructor cards, package/promo images) — those are fine with normal cropping since they're typically photos where a slight crop doesn't lose anything important

Do not resize, compress, or otherwise reduce the quality of uploaded images anywhere — they should render at their original resolution, scaled by the browser to fit their container

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://drive-smart-bulawayo.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c52d3735-1de2-48c6-8736-887b32e47e4b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
