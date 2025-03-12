# AI Powered Website Builder

This is an AI-powered website builder project built with [Next.js](https://nextjs.org), [Tailwind CSS](https://tailwindcss.com), and various other modern web technologies. The project leverages AI to assist in generating and enhancing website content and code.

### Live Preview : [View](https://ai-website-builder-mu.vercel.app/)

## Getting Started

First, clone the repository and navigate to the project directory:

```bash
git clone <repository-url>
cd ai-website-generator
```

Install the dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- `app/`: Contains the main application components and pages.
- `components/`: Custom React components used throughout the project.
- `configs/`: Configuration files for AI models and other settings.
- `context/`: React context providers for managing global state.
- `convex/`: Convex server functions and schema definitions.
- `data/`: Static data and prompt definitions.
- `lib/`: Utility functions.
- `public/`: Public assets and static files.
- `styles/`: Global styles and CSS files.

## Features

- **AI Chat**: Interact with an AI assistant to generate and enhance website content.
- **Code Generation**: Automatically generate React code based on user prompts.
- **Theme Support**: Light and dark mode support using `next-themes`.
- **Real-time Collaboration**: Use Convex for real-time data synchronization.

## Tech Stack

- **Next.js**: A React framework for building server-side rendered applications.
- **Tailwind CSS**: A utility-first CSS framework for rapid UI development.
- **Convex**: A platform for real-time data synchronization and collaboration.
- **Lucide React**: A library of icons for React applications.
- **Axios**: A promise-based HTTP client for making API requests.
- **React Markdown**: A component for rendering Markdown in React applications.
- **JSZip**: A library for creating and managing ZIP files in JavaScript.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
