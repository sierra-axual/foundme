# FoundMe People OSINT Tools Docker Image
# Specialized for people tracking and digital footprint mapping

FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV TOOLS_DIR=/opt/people-osint
ENV PATH=$PATH:$TOOLS_DIR:/usr/local/go/bin
ENV GOPATH=/opt/go
ENV GOROOT=/usr/local/go

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    unzip \
    build-essential \
    ca-certificates \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Go (required for some people OSINT tools)
RUN wget https://go.dev/dl/go1.21.6.linux-amd64.tar.gz && \
    tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz && \
    rm go1.21.6.linux-amd64.tar.gz

# Create tools directory and Go workspace
RUN mkdir -p $TOOLS_DIR $GOPATH/bin $GOPATH/src $GOPATH/pkg

# Install Python tools and Flask for API
RUN pip3 install flask requests beautifulsoup4 lxml exifread pillow

# ===== PEOPLE-FOCUSED OSINT TOOLS =====

# 1. SHERLOCK - Username enumeration across 400+ social networks
RUN pip3 install sherlock-project

# 2. THEHARVESTER - Email and person information gathering
RUN pip3 install theHarvester

# 3. HOLEHE - Email account checker for 120+ websites
RUN pip3 install holehe

# 4. PHONEINFOGA - Skip for now (complex installation)
# Will be added later via pip if available

# 5. SOCIAL ANALYZER - Skip for now (complex Node.js installation)
# Will be added later

# 6. H8MAIL - Email-based password breach hunting
RUN pip3 install h8mail

# 7. MAIGRET - Advanced username OSINT collection
RUN pip3 install maigret

# 8. EXIF TOOLS - Image metadata extraction
RUN pip3 install exifread pillow

# 9. Additional tools (can be added later)
# SpiderFoot and other complex tools will be added in future iterations

# Create wrapper scripts for standardized people OSINT operations
RUN echo '#!/bin/bash\nsherlock "$1" --output /tmp/sherlock_output.txt' > $TOOLS_DIR/sherlock_wrapper.sh && \
    echo '#!/bin/bash\ntheHarvester -d "$1" -b all' > $TOOLS_DIR/theharvester_wrapper.sh && \
    echo '#!/bin/bash\nholehe "$1"' > $TOOLS_DIR/holehe_wrapper.sh && \
    echo '#!/bin/bash\nh8mail -t "$1"' > $TOOLS_DIR/h8mail_wrapper.sh && \
    echo '#!/bin/bash\nmaigret "$1"' > $TOOLS_DIR/maigret_wrapper.sh && \
    chmod +x $TOOLS_DIR/*.sh

# Copy the new People OSINT API server
COPY people_api.py $TOOLS_DIR/people_api.py
RUN chmod +x $TOOLS_DIR/people_api.py

# Set working directory
WORKDIR $TOOLS_DIR

# Expose API port
EXPOSE 5000

# Start the People OSINT API server
CMD ["python3", "people_api.py"]
