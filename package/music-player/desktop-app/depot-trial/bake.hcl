variable "TRIAL_RUN" {
  default = "initial"
}

variable "BUILD_JOBS" {
  default = "4"
}

variable "REQUIRE_FAILURE" {
  default = "0"
}

variable "TRIAL_LOG_VERSION" {
  default = "unchanged"
}

variable "TRIAL_LINKER" {
  default = "default"
}

target "toolchain" {
  context = "."
  dockerfile = "package/music-player/desktop-app/Containerfile.alpine"
  target = "build"
  platforms = ["linux/amd64"]
}

target "runtime" {
  context = "."
  dockerfile = "package/music-player/desktop-app/Containerfile.alpine"
  target = "runtime"
  platforms = ["linux/amd64"]
}

target "artifact" {
  context = "."
  dockerfile = "package/music-player/desktop-app/depot-trial/Containerfile"
  target = "artifact"
  contexts = {
    toolchain = "target:toolchain"
    runtime = "target:runtime"
  }
  args = {
    TRIAL_RUN = TRIAL_RUN
    BUILD_JOBS = BUILD_JOBS
    REQUIRE_FAILURE = REQUIRE_FAILURE
    TRIAL_LOG_VERSION = TRIAL_LOG_VERSION
    TRIAL_LINKER = TRIAL_LINKER
  }
  platforms = ["linux/amd64"]
  output = ["type=local,dest=package/music-player/desktop-app/target/depot-trial"]
}
