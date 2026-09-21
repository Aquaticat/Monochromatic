FROM registry.fedoraproject.org/fedora:44
RUN dnf install --assumeyes \
      clang \
      cmake \
      compat-lua-devel \
      gcc \
      gcc-c++ \
      make \
      openssl-devel \
      perl \
      pkgconf-pkg-config \
    && dnf clean all
