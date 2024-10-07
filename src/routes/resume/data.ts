import TurboMenu from "./assets/turbomenu-icon.svg";
import Quickset from "./assets/quickset.svg";

import Konrad from "./assets/konrad.svg";
import Procter from "./assets/procter.svg";
import uoft from "./assets/uoft.svg";
import Siteful from "./assets/siteful.svg";

export const projects = [
  {
    company: "TurboMenu",
    description: [
      "A free tool for restaurants to **create QR code menus.** [10,000+ monthly visits](https://winken.io/turbo.menu){target=_blank}.",
    ],
    website: "https://turbo.menu",
    code: "https://github.com/azakiio/turbomenu",
    icon: TurboMenu,
  },
  {
    company: "Quickset",
    description: [
      "A **real-time, multiplayer** card game built on **Elixir** and **Phoenix LiveView**.",
    ],
    website: "https://www.quickset.online/",
    code: "https://github.com/azakiio/quickset",
    icon: Quickset,
  },
  {
    company: "Nice Buttons",
    description: [
      "A **CSS generator** for creating beautiful gradient hover effects built with **Svelte**.",
    ],
    website: "https://www.quickset.online/",
    code: "https://github.com/azakiio/quickset",
    icon: Quickset,
  },
];

export const education = {
  company: "University of Toronto",
  positions: [
    {
      role: "Industrial Engineering",
      startDate: "2015-09-01",
      endDate: "2020-06-01",
    },
  ],
  description: ["Graduated with Honours", "Minor in AI Engineering"],
  icon: uoft,
};

export const experiences = [
  {
    company: "Siteful.io",
    link: "https://siteful.io",
    positions: [
      {
        role: "Founder & Operator",
        startDate: "2024-01-02",
        endDate: undefined,
      },
    ],
    description: [
      "Founded & operate a web development start-up producing **polished, high-performance** web applications for a wide [range of clients](/projects){target=_blank}.",
      "**Leading the full project lifecycle**, from design to deployment, ensuring **robust, secure, and efficient** solutions.",
      "Engage deeply with clients to accurately scope projects, and **align technical strategies with stakeholder** expectations.",
      "**Balanced trade-offs** to meet long-term goals and adhere to engineering principles, consistently **delivering within strict deadlines.**",
    ],
    icon: Siteful,
  },
  {
    company: "Konrad Group",
    link: "https://www.konrad.com/",
    positions: [
      {
        role: "Full Stack Developer",
        startDate: "2020-06-02",
        endDate: "2023-06-02",
      }
    ],
    description: [
      "Developed and shipped **responsive** websites involving **multiple backend services** and **Content Management Systems**",
      "Navigated a fast-paced environment, effectively managing client expectations and **delivering high-quality solutions.**",
      "Developed a custom shopping experience for [Equinox+](https://shop.equinoxplus.com/){target=_blank} powered by **React**, **Stripe** and **Shopify**, enhancing the user experience and streamlining transactions.",
      "Implemented technical patterns like **user authentication** and **location services** for [Kia.ca](http://kia.ca/){target=_blank}.",
      "Automated laborious CMS migration tasks, **saving** roughly **8 hours per week.**",
    ],
    icon: Konrad,
  },
  {
    company: "Procter & Gamble",
    link: "https://www.pg.com/",
    positions: [
      {
        role: "Data Science Intern",
        startDate: "2018-05-02",
        endDate: "2019-05-02",
      },
    ],
    description: [
      "Developed data pipelines in Python to **analyze web traffic** and **assess online marketing performance**. Optimized advertisement spending, achieving a **15% increase in conversions** with the **same budget** by refining channel strategies and targeting high-value opportunities.",
      "Created interactive dashboards to **visualize marketing metrics**, facilitating real-time performance tracking and **data-driven decision-making.**",
      "Automated web-page performance audits using JavaScript and **collaborated with brand teams** to implement improvements, resulting in a **3-5 second reduction in page load times** and a **~2-position boost in Google Search rankings.**",
    ],
    icon: Procter,
  },
];

export const skills = {
  frontendDevelopment: [
    { label: "Javascript", icon: "logos:javascript" },
    { label: "Typescript", icon: "logos:typescript-icon" },
    { label: "HTML", icon: "devicon:html5" },
    { label: "React", icon: "logos:react" },
    { label: "Next.js", icon: "logos:nextjs-icon" },
    { label: "Remix", icon: "logos:remix-icon" },
    // { label: "Gatsby", icon: "logos:gatsby" },
    { label: "Vue", icon: "logos:vue" },
    { label: "Svelte", icon: "logos:svelte-icon" },
    { label: "Astro", icon: "logos:astro-icon" },
    { label: "Phoenix", icon: "logos:phoenix" },
    { label: "CSS", icon: "devicon:css3" },
    // { label: "Tailwind", icon: "logos:tailwindcss-icon" },
  ],
  backendDevelopment: [
    { label: "Node.js", icon: "logos:nodejs-icon" },
    { label: "Elixir", icon: "devicon:elixir" },
    { label: "PostgreSQL", icon: "logos:postgresql" },
    { label: "Firebase", icon: "logos:firebase" },
    { label: "MongoDB", icon: "logos:mongodb-icon" },
    { label: "AWS", icon: "logos:aws" },
    { label: "Google Cloud", icon: "logos:google-cloud" },
    { label: "GraphQL", icon: "logos:graphql" },
    // { label: "Contentful", icon: "logos:contentful" },
    { label: "Stripe", icon: "logos:stripe" },
  ],
  machineLearning: [
    { label: "Python", icon: "logos:python" },
    { label: "Pytorch", icon: "logos:pytorch-icon" },
    { label: "TensorFlow", icon: "logos:tensorflow" },
    { label: "Numpy", icon: "logos:numpy" },
    { label: "Pandas", icon: "logos:pandas-icon" },
  ],
};

export const hobbies = [
  { label: "guitar", icon: "fa-solid:guitar" },
  { label: "chess", icon: "fa-solid:chess" },
  { label: "gaming", icon: "mdi:controller" },
  { label: "swimming", icon: "fa-solid:swimmer" },
  { label: "coding", icon: "fa-solid:code" },
  {
    label: "cat",
    icon: "fa-solid:cat",
    link: "https://www.instagram.com/wally.wallberg/",
  },
];
