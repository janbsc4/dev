# Add Motion Design

The repo contains a finished website with no motion in it. Add one cohesive motion design pass to that site, on a new separate branch. The subject, content, and design are already decided; your job is motion that fits what's already there. How well the motion serves the existing site is part of what's being evaluated.

Context you should know: this is going into a video comparing you against other frontier models, shown to a large audience, and your work will be credited to you by name. Every model gets this exact prompt. So go nuts and show people what you're actually capable of.

Requirements:

1. **The subject is fixed. Your job is to serve it.** Read the site first. Understand what it's about, what the hierarchy is, where a viewer's eye should go, and let every motion decision come out of that. Off the table: the pass every model reaches for, an IntersectionObserver that fades each section up 20px as it enters the viewport. Also off the table: a parallax hero, a marquee, and animated counters bolted on because they look impressive. If a motion could be pasted onto any other site unchanged, it isn't motion for this site.

2. **The site has to keep working.** Don't rebuild it, don't redesign it, don't touch the copy or the layout. Motion gets layered on top of a finished thing. Everything that worked before your pass still works after it: links, scrolling, forms, resize, refresh.

3. **Choreography is the whole test.** Pull from whatever best serves this site, including but not limited to: staggered reveals that follow the content's actual hierarchy, easing with real authored weight, overshoot and anticipation, masking and reveal wipes, SVG path drawing and morphing, kinetic type, scroll-driven sequences, hover and focus states with intent, view transitions, mix-blend-mode compositing, shader-based transitions, grain and optical treatment. Choose what fits rather than working through the list.

4. **You have free reign to look up how to use any of these, and to pull in open source animation libraries freely.** GSAP, anime.js, Lenis, Three.js, anything on a CDN. Add any other technique you think demonstrates more. The list is a starting point, not a boundary.

5. **Timing is what separates motion design from decoration.** Beats should land with intent, moments should breathe, and the piece should build as you move through the site. If everything enters at the same speed with the same easing, it has failed.

6. **You are graded on what you left out.** Most of the site should probably get nothing. A handful of moves placed where they point at what matters beats motion on every element. Restraint is part of what's being measured.

7. **Do not hand back the template.** Fade-ups on every section, staggered card entrances, a springy cursor blob, scroll-jacked full-page snaps. A large audience has seen that combination hundreds of times and it reads as a default rather than a decision. If you land on any of it, earn it and make it specific to this site.

8. **Work in the existing codebase.** Edit its files; libraries via CDN if you need them. No build step, no API keys, no new pages, no content changes.

9. **No new assets.** No hotlinked images, video, or stock footage. The motion is generated in-browser: CSS, SVG, canvas, JS.

10. **QA it by watching it.** Go through the whole site start to finish several times. Check that beats don't collide, nothing pops in unstyled, the console stays clean, it holds 60fps while scrolling and interacting, and `prefers-reduced-motion` gets a real answer, not a flicker.

Work completely autonomously. Do not ask for anything until it's finished.

DONE when: the site works end to end exactly as it did before, the motion is authored rather than uniform, every move fits the content that was already there, and it is not a fade-up pass.