import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "cn"

// UISwitch proportions (51×31, 27pt knob) and the system-green "on" track.
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full bg-fill p-0.5 outline-none transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[checked]:bg-ios-green",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_3px_1px_rgb(0_0_0/0.06)] ring-0 transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] data-[unchecked]:translate-x-0 data-[checked]:translate-x-5"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
