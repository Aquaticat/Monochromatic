variable "PROJECT" { default = "unallocated" }
variable "OUTPUT_DIRECTORY" { default = "." }
variable "HARNESS_SHA" { default = "print-control" }
variable "SECRET_FILE" { default = "fixture-secret" }
variable "SSH_SOCKET" { default = "fixture-agent.sock" }
variable "SECRET_HASH" { default = "print-control" }
variable "AGENT_NONCE" { default = "print-control" }
group "default" { targets = ["service", "evidence"] }
target "shared" {
  context = "context"
  dockerfile = "Dockerfile"
  platforms = ["linux/amd64", "linux/arm64"]
  args = { BUILD_HARNESS_SHA = HARNESS_SHA }
  project_id = PROJECT
}
target "service" {
  inherits = ["shared"]
  target = "service"
  output = ["type=oci,dest=${OUTPUT_DIRECTORY}/service.oci.tar"]
  attest = ["type=provenance,mode=max", "type=sbom,generator=docker.io/docker/buildkit-syft-scanner@sha256:ae4f3b554449e7e25548e7d8ccc029d17357348e30c6e3df01b92bc93654d6a9"]
}
target "source" {
  inherits = ["shared"]
  target = "source-evidence"
  output = ["type=local,dest=${OUTPUT_DIRECTORY}/builder-proof"]
}
target "evidence" {
  inherits = ["shared"]
  target = "evidence"
  contexts = { fixtureinput = "fixture-input" }
  args = { EXPECTED_SECRET_HASH = SECRET_HASH, EXPECTED_AGENT_NONCE = AGENT_NONCE }
  secret = ["id=fixture,src=${SECRET_FILE}"]
  ssh = ["fixture=${SSH_SOCKET}"]
  output = ["type=local,dest=${OUTPUT_DIRECTORY}/proof"]
}

target "ci" {
  context = "ci-context"
  dockerfile = "Dockerfile"
  platforms = ["linux/amd64", "linux/arm64"]
  args = { CI_IMAGE_HARNESS_SHA = HARNESS_SHA }
  project_id = PROJECT
  output = ["type=image"]
  attest = ["type=provenance,mode=max", "type=sbom,generator=docker.io/docker/buildkit-syft-scanner@sha256:ae4f3b554449e7e25548e7d8ccc029d17357348e30c6e3df01b92bc93654d6a9"]
}
