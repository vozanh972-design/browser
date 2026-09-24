"use client";

import { LuArrowRight, LuBoxes, LuFlag, LuUsers } from "react-icons/lu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UtilitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectOption: (option: "nuoi-acc" | "reg-page") => void;
}

export function UtilitiesDialog({
  open,
  onOpenChange,
  onSelectOption,
}: UtilitiesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 bg-background border-border">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <LuBoxes className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Tiện ích mở rộng
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Chọn công cụ tiện ích bạn muốn làm việc
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 pt-2">
          {/* Option 1: Reg Page */}
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onSelectOption("reg-page");
            }}
            className="group flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-muted/20 hover:bg-muted/50 hover:border-primary/50 transition-all text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
                <LuFlag className="size-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    1. Reg Page
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Fanpage
                  </span>
                </div>
                <span className="text-[11.5px] text-muted-foreground mt-0.5 line-clamp-1">
                  Tạo Fanpage tự động hàng loạt, cấu hình tên page & thể loại
                </span>
              </div>
            </div>
            <LuArrowRight className="size-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>

          {/* Option 2: Nuôi Acc */}
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onSelectOption("nuoi-acc");
            }}
            className="group flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-muted/20 hover:bg-muted/50 hover:border-primary/50 transition-all text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                <LuUsers className="size-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    2. Nuôi Acc
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Tài khoản
                  </span>
                </div>
                <span className="text-[11.5px] text-muted-foreground mt-0.5 line-clamp-1">
                  Quản lý danh sách tài khoản, kiểm tra Live, Token, Cookie & chạy tương tác
                </span>
              </div>
            </div>
            <LuArrowRight className="size-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
