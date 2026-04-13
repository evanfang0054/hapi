import { render, screen } from '@testing-library/react'
import { createContext, useContext } from 'react'
import ReactMarkdown from 'react-markdown'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let currentMarkdown = ''

const CodeBlockContext = createContext(false)

vi.mock('@assistant-ui/react-markdown', () => ({
    MarkdownTextPrimitive: ({ remarkPlugins, rehypePlugins, components, className }: any) => (
        <div className={className}>
            <ReactMarkdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={{
                    ...components,
                    pre: ({ children, ...props }: any) => (
                        <CodeBlockContext.Provider value={true}>
                            {components?.pre ? components.pre({ ...props, children }) : <pre {...props}>{children}</pre>}
                        </CodeBlockContext.Provider>
                    ),
                }}
            >
                {currentMarkdown}
            </ReactMarkdown>
        </div>
    ),
    unstable_memoizeMarkdownComponents: <T,>(components: T) => components,
    useIsMarkdownCodeBlock: () => useContext(CodeBlockContext),
}))

vi.mock('@/components/assistant-ui/shiki-highlighter', () => ({
    SyntaxHighlighter: ({ code }: { code?: string }) => <>{code ?? null}</>,
}))

vi.mock('@/hooks/useCopyToClipboard', () => ({
    useCopyToClipboard: () => ({
        copied: false,
        copy: vi.fn(),
    }),
}))

vi.mock('@/components/icons', () => ({
    CopyIcon: () => <span>copy</span>,
    CheckIcon: () => <span>check</span>,
}))

import { MarkdownText } from './markdown-text'

describe('markdown math rendering', () => {
    beforeEach(() => {
        currentMarkdown = ''
    })

    it('renders inline math without breaking normal markdown', () => {
        currentMarkdown = 'Energy: $E=mc^2$'
        const { container } = render(<MarkdownText />)

        expect(screen.getByText('Energy:')).toBeInTheDocument()
        expect(container.querySelector('.katex')).not.toBeNull()
    })

    it('renders block math', () => {
        currentMarkdown = ['$$', '\\int_0^1 x \\, dx', '$$'].join('\n\n')
        const { container } = render(<MarkdownText />)

        expect(container.querySelector('.katex-display')).not.toBeNull()
    })

    it('keeps code fences as code instead of math', () => {
        currentMarkdown = ['```text', '$not-math$', '```'].join('\n')
        const { container } = render(<MarkdownText />)

        expect(container.querySelector('.katex')).toBeNull()
        expect(container.querySelector('pre code')).not.toBeNull()
        expect(screen.getByText('$not-math$')).toBeInTheDocument()
    })
})
