import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const buttonVariants=cva('btn',{variants:{variant:{default:'btn-primary',outline:'',destructive:'btn-danger'},size:{default:'',sm:'!px-2 !py-1 text-xs'}},defaultVariants:{variant:'default',size:'default'}});
export function Button({className,variant,size,asChild=false,...props}:React.ComponentProps<'button'>&VariantProps<typeof buttonVariants>&{asChild?:boolean}) {
 const Component=asChild?Slot:'button';
 return <Component data-slot="button" className={cn(buttonVariants({variant,size,className}))} {...props}/>;
}
