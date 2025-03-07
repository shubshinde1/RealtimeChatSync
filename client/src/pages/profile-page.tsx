import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, ArrowLeft, Upload, Trash2, User } from "lucide-react";
import { Link } from "wouter";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const profilePictureSchema = z.object({
  profilePicture: z.string().url("Please enter a valid image URL"),
});

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const passwordForm = useForm({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const profilePictureForm = useForm({
    resolver: zodResolver(profilePictureSchema),
    defaultValues: {
      profilePicture: user?.profilePicture || "",
    },
  });

  const passwordChangeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordChangeSchema>) => {
      await apiRequest("POST", "/api/user/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      passwordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const profilePictureMutation = useMutation({
    mutationFn: async (data: z.infer<typeof profilePictureSchema>) => {
      const res = await apiRequest("POST", "/api/user/profile-picture", data);
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update profile picture",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProfilePictureMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/user/profile-picture");
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
      profilePictureForm.reset({ profilePicture: "" });
      toast({
        title: "Profile picture removed",
        description: "Your profile picture has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove profile picture",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl py-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-6 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Chat
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Profile Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Picture Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Profile Picture</h3>
              <div className="flex justify-center mb-4">
                <div className="relative h-24 w-24 rounded-full overflow-hidden bg-primary/10">
                  {user?.profilePicture ? (
                    <img
                      src={user.profilePicture}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <User className="h-12 w-12 text-primary" />
                    </div>
                  )}
                </div>
              </div>
              <Form {...profilePictureForm}>
                <form onSubmit={profilePictureForm.handleSubmit((data) => profilePictureMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={profilePictureForm.control}
                    name="profilePicture"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profile Picture URL</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input {...field} placeholder="Enter image URL" />
                            <Button
                              type="submit"
                              size="icon"
                              disabled={profilePictureMutation.isPending}
                            >
                              {profilePictureMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                            </Button>
                            {user?.profilePicture && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                disabled={deleteProfilePictureMutation.isPending}
                                onClick={() => deleteProfilePictureMutation.mutate()}
                              >
                                {deleteProfilePictureMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </div>

            {/* User Info */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Account Information</h3>
              <div className="grid gap-1">
                <p className="text-sm font-medium text-muted-foreground">Username</p>
                <p className="text-sm">{user?.username}</p>
              </div>
            </div>

            {/* Password Change Form */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Change Password</h3>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit((data) => passwordChangeMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={passwordChangeMutation.isPending}
                  >
                    {passwordChangeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Change Password"
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}